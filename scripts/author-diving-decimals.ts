import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// Diving/Snorkeling/Freediving de-flattening pass (docs/interest-
// content-authoring-playbook.md §2). This interest had the largest
// over-claiming problem found in the whole project: roughly ten of the
// world's most famous dive destinations each independently claimed a
// wide (5-11 month) flat 10.0 plateau — not all of them can be a
// top-5-in-the-world dive destination for the same activity. Real-
// world research this session: Raja Ampat, the Red Sea, Galápagos,
// the Maldives, and the Great Barrier Reef are the destinations
// consistently grouped as the genuine top tier across multiple
// rankings; Palau, Sipadan (Malaysian Borneo), and Komodo are
// frequently mentioned but consistently a notch below; Fiji and Belize
// are excellent and famous for specific things (soft corals; the Blue
// Hole/whale sharks) without showing up in the "best overall" lists.
// Tapered accordingly, and narrowed each plateau toward the months the
// destination's OWN text actually signals as most special — several
// of these also contained a real bug where distinct, lesser-claiming
// text was tied to the identical peak score as the full claim (Raja
// Ampat's shared sentence literally names "especially January and
// February" while tying March/April to the same 10.0; Palau's May
// "conditions are easing" and October "conditions are improving" text
// were each tied to the same 10.0 as the surrounding true-peak text;
// Fiji's April "conditions are improving fast" likewise).
//
// Two separate, more severe bugs (not just over-claiming) were also
// fixed here:
//  - belize: the second half of the year is a single "hurricane
//    season" claim smeared across one recycled sentence, but the
//    score swings from 8.5 (Jun) to 6.8 (Jul) to 2.4 (Aug-Oct) to a
//    sudden, unexplained 8 (Nov) — a real cliff, not a curve. Rewrote
//    Jun/Jul/Nov with their own honest text and gave Aug-Oct one
//    shared "peak hurricane season" sentence to match their now-
//    identical score, consistent with how this catalog's other
//    Caribbean hurricane-season destinations (Bahamas, Turks & Caicos,
//    Havana) handle the same real seasonal shape correctly already.
//  - jamaica: August reused July's identical "brief better window"
//    sentence while scoring dramatically lower (1.5 vs 4.25); Sept/Oct/
//    Nov reused the same "wetter, hurricane-risk" sentence already used
//    for the mild early-season months (May/Jun), hiding the real peak-
//    season/recovery shape inside unchanged text. Gave August, Sept/
//    Oct, and November their own honest sentences matching what the
//    score already claimed.
//  - rivieramaya: April shares the identical "dry season — the best
//    reef diving conditions" sentence with Jan-Mar but craters to 5.4
//    — a real bug (Riviera Maya's dry season genuinely runs into
//    April), brought back in line.
const KEY = 'diving';

interface Fix {
  scores: Partial<Record<number, number>>;
  text?: Partial<Record<number, string>>;
}

const FIXES: Record<string, Fix> = {
  gbr: { scores: { 4: 9.7, 5: 9.7, 6: 9.7, 7: 9.7, 8: 9.7, 9: 9.7 } },
  rajaampat: { scores: { 2: 9.5, 3: 9.5, 9: 9.6, 10: 9.6, 11: 9.6 } },
  egypt: { scores: { 2: 9, 8: 9 } },
  borneo: { scores: { 2: 9.6, 3: 9.6, 4: 9.6, 5: 9.6, 6: 9.6, 7: 9.6, 8: 9.6, 9: 9.6 } },
  palau: { scores: { 0: 9.6, 1: 9.6, 2: 9.6, 3: 9.6, 4: 8.5, 9: 8.5, 10: 9.6, 11: 9.6 } },
  maldives: { scores: { 0: 9.6, 1: 9.6, 2: 9.6, 3: 9.6, 11: 9.6 } },
  fiji: { scores: { 3: 9, 4: 9.3, 5: 9.3, 6: 9.3, 7: 9.3, 8: 9.3, 9: 9.3 } },
  komodo: { scores: { 3: 9.4, 4: 9.4, 5: 9.4, 6: 9.4, 7: 9.4, 8: 9.4, 9: 9.4, 10: 9.4, 11: 9.2 } },
  galapagos: { scores: { 5: 9.6, 6: 9.6, 7: 9.6, 8: 9.6, 9: 9.6, 10: 9.6 } },
  rivieramaya: { scores: { 3: 8.5 } },
  belize: {
    scores: { 0: 9.5, 1: 9.5, 2: 9.6, 3: 9.6, 4: 9.6, 5: 8, 6: 6.5, 7: 2.5, 8: 2.5, 9: 2.5, 10: 5.5, 11: 9.5 },
    text: {
      5: 'Hurricane season technically begins, though conditions often stay calm early on; the Gladden Spit whale shark aggregation can still be active around the full moon.',
      6: 'Hurricane season is underway — conditions are more weather-dependent, though this early in the season it’s often still workable.',
      7: 'Peak hurricane season — the roughest seas and lowest visibility of the year, with real potential for trip disruption.',
      8: 'Peak hurricane season — the roughest seas and lowest visibility of the year, with real potential for trip disruption.',
      9: 'Peak hurricane season — the roughest seas and lowest visibility of the year, with real potential for trip disruption.',
      10: 'Hurricane season is ending and conditions are improving, though some risk of disruption remains into early in the month.',
    },
  },
  jamaica: {
    scores: { 7: 1.8, 8: 0.9, 9: 0.9, 10: 2.55 },
    text: {
      7: 'Hurricane season risk is climbing toward its peak — conditions are notably less reliable.',
      8: 'Peak hurricane season — the least reliable, roughest stretch of the year.',
      9: 'Peak hurricane season — the least reliable, roughest stretch of the year.',
      10: 'Hurricane season is ending and conditions are recovering.',
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
    const textEntries = Object.entries(fix.text ?? {}).filter(([, v]) => v !== undefined);
    if (textEntries.length > 0) {
      const mw = [...((row.sliderMonthlyWeather as Record<string, (string | null)[]>)?.[KEY] || new Array(12).fill(null))];
      for (const [idxStr, text] of textEntries) mw[Number(idxStr)] = text as string;
      patch.sliderMonthlyWeather = { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: mw };
    }

    console.log(`\n${row.name} (${id}) — ${changedCount} scores changed, ${textEntries.length} text updated`);
    for (const [idxStr, val] of Object.entries(fix.scores)) {
      const idx = Number(idxStr);
      if (val !== undefined && live[idx] !== val) {
        console.log(`  ${MONTH_NAMES[idx].padEnd(10)} ${live[idx]} -> ${val}${fix.text?.[idx] ? '  [text updated]' : ''}`);
      }
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
