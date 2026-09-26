import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// Wildflowers & Seasonal Blooms de-flattening pass (docs/interest-
// content-authoring-playbook.md §2). This catalog was already well
// authored (no destination has 3+ months flat at a literal 10 the way
// hotSprings' Iceland/Hokkaido/Budapest did — every "peak" here is
// already a narrow 1-2 month window, so there's no true-10-rarity
// problem to fix). The violation found instead is the MIRROR of the
// whaleWatching-era bug: distinct text describing a real, if minor,
// bloom stage — tied to the EXACT SAME score as the "outside season /
// no blooms" baseline months. Same rule, opposite direction: distinct
// text should get a (possibly small) distinct score, not just distinct
// same-integer text.
//
//  - lapland: June/July ("brief arctic summer... cloudberry flowers and
//    other tundra blooms", "continuing") and August ("fading") were
//    tied at 3, identical to the 9 literal "no blooms" months. Text
//    calls this "a minor seasonal detail", so kept the bump small.
//  - azores: September ("hydrangea season fading") tied at 6, identical
//    to the 8 "outside hydrangea season" months.
//  - joshua-tree: April ("the best of the typical annual bloom") tied
//    at 4, identical to March ("a modest annual bloom typically
//    beginning") — the described peak should exceed the described
//    start, even for a modest, rain-dependent annual bloom.
//  - nepal: May ("fading at lower elevations, occasionally still active
//    higher up") tied at 3, identical to the literal "outside
//    rhododendron season" months.
//  - badlands-black-hills: May/June/July describe a real (if
//    explicitly "minor") prairie wildflower cycle — beginning, "at its
//    best", fading — all three tied at 3, identical to the 9 "outside
//    bloom season" months.
//  - santorini: April/May ("some spring color on the caldera slopes,
//    still a minor and secondary sight") tied at 3, identical to the
//    "wildflowers are a minor, scattered presence here year-round"
//    baseline used for the other 10 months.
//  - zermatt (swissalps): June ("beginning as meadows clear of snow"),
//    July ("peak"), and August ("continuing") were flat at 7 — a real
//    bug by this catalog's own convention: every sibling alpine-
//    wildflower destination (Glacier & Waterton, Kyrgyzstan, North
//    Cascades) scores its "beginning" month distinctly below its
//    "peak" month. Zermatt is the one place this session found where
//    "beginning" and "peak" carry no distinction at all.
//  - lake-district: a real, direct bug. February's text is the
//    identical "Outside daffodil season." used for the 8 baseline
//    months at 4 — yet was itself scored 6. Real UK daffodil pattern:
//    the earliest sheltered/species daffodils can appear in February,
//    well before the Ullswater display builds in March — gave it its
//    own sentence to match the score it already had.
const KEY = 'wildflowerBlooms';

interface Fix {
  scores: Partial<Record<number, number>>;
  text: Partial<Record<number, string>>;
}

const FIXES: Record<string, Fix> = {
  lapland: {
    scores: { 5: 4, 6: 4.5, 7: 3.5 },
    text: {},
  },
  azores: {
    scores: { 8: 6.5 },
    text: {},
  },
  'joshua-tree': {
    scores: { 3: 5 },
    text: {},
  },
  nepal: {
    scores: { 4: 4 },
    text: {},
  },
  'badlands-black-hills': {
    scores: { 4: 3.5, 5: 4, 6: 3.5 },
    text: {},
  },
  santorini: {
    scores: { 3: 3.3, 4: 3.3 },
    text: {},
  },
  swissalps: {
    scores: { 5: 6, 6: 7.5, 7: 7 },
    text: {},
  },
  'lake-district': {
    scores: { 1: 5 },
    text: {
      1: 'The very first daffodils can appear in sheltered spots this early, but the Ullswater display proper is still weeks away.',
    },
  },
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

async function main() {
  const env = loadDotEnvLocal();
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const ids = Object.keys(FIXES);
  const rows = await db.select().from(places).where(inArray(places.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const id of ids) {
    const row = byId.get(id);
    if (!row) { console.error(`${id}: not found`); process.exit(1); }

    const scoreOverridesBefore = (row.scoreOverrides as Record<string, Record<number, number>>) || {};
    const scored = scorePlace(row);
    const live = scored.monthly[KEY];
    const fix = FIXES[id];

    const finalOverride: Record<number, number> = { ...(scoreOverridesBefore[KEY] || {}) };
    let changedCount = 0;
    for (const [idxStr, val] of Object.entries(fix.scores)) {
      const idx = Number(idxStr);
      if (val === undefined) continue;
      if (live[idx] !== val) changedCount++;
      finalOverride[idx] = val;
    }

    const patch: Record<string, unknown> = {
      scoreOverrides: { ...scoreOverridesBefore, [KEY]: finalOverride },
    };
    const textEntries = Object.entries(fix.text).filter(([, v]) => v !== undefined);
    if (textEntries.length > 0) {
      const mw = [...((row.sliderMonthlyWeather as Record<string, (string | null)[]>)?.[KEY] || new Array(12).fill(null))];
      for (const [idxStr, text] of textEntries) mw[Number(idxStr)] = text as string;
      patch.sliderMonthlyWeather = { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: mw };
    }

    console.log(`\n${row.name} (${id}) — ${changedCount} scores changed, ${textEntries.length} text updated`);
    for (const [idxStr, val] of Object.entries(fix.scores)) {
      const idx = Number(idxStr);
      if (val !== undefined && live[idx] !== val) {
        console.log(`  ${MONTH_NAMES[idx].padEnd(10)} ${live[idx]} -> ${val}${fix.text[idx] ? '  [text updated]' : ''}`);
      }
    }
    for (const [idxStr, text] of textEntries) {
      const idx = Number(idxStr);
      if (!(idx in fix.scores)) console.log(`  ${MONTH_NAMES[idx].padEnd(10)} [text only] ${text}`);
    }

    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000',
          entityType: 'destination',
          entityId: id,
          action: 'update',
          beforeValue: row,
          afterValue: after,
        });
      });
    }
  }

  console.log(dryRun ? '\n\ndry run — nothing written.' : '\n\ndone — written to scoreOverrides / sliderMonthlyWeather.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
