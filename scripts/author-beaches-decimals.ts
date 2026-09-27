import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, inArray } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// Beaches & Swimming de-flattening pass (docs/interest-content-
// authoring-playbook.md §2). Same over-claiming pattern as diving:
// nine destinations each independently claimed a wide (4-8 month) flat
// 10.0 plateau. Real-world research this session: beach "best in the
// world" rankings are notoriously beach-specific and volatile year to
// year (World's 50 Best Beaches 2026 crowned Palawan's Entalula Beach
// #1, with Turks & Caicos' Grace Bay a perennial name-brand icon but
// Maldives/Bora Bora/Seychelles/Maui not appearing in the very top
// slots of that particular expert list despite their broader iconic
// reputation) — so rather than force a precise tier ranking the way
// diving's clearer specialist consensus allowed, plateaus were tapered
// proportionally to their width (wider plateau = bigger cut), with
// palawan given the strongest claim given its current #1 ranking.
// Two of these also contained the same real bug found elsewhere this
// session — distinct, lesser-claiming text tied to the identical peak
// score as the full claim:
//  - mauritius: November ("trade winds easing as cyclone season
//    approaches") was tied to the same 10.0 as May-October's flat
//    "Same calm trade-wind conditions" text.
//  - borabora: April ("cyclone season is ending; conditions calm
//    quickly") was tied to the same 10.0 as May-November's flat "Same
//    calm, dry-season conditions" text.
//  - maui: April ("winter swell is easing... improving") and May ("a
//    comfortable, TRANSITIONAL month") were each tied to the same 10.0
//    as June-September's true, fully-settled peak text.
//
// Two unrelated, more severe bugs (not just over-claiming) were also
// found and fixed:
//  - hongkong: July/August/September scored a flat 0 — the absolute
//    minimum — under text that says only "Peak warmth" / "Same peak
//    warmth" (purely positive-sounding, no explanation). Real Hong
//    Kong climate: this is typhoon season, peaking exactly in this
//    window — the score was likely right, the text just never said
//    why. Gave it the real explanation (matching how this catalog's
//    other Hong Kong slider entries already handle typhoon season)
//    and moved the score off literal zero to acknowledge it's not
//    universally unswimmable, just genuinely risky.
//  - sydney: July was an isolated one-month cliff (score 3) sandwiched
//    between June and August, both 8, all three sharing the identical
//    "cool winter water" framing — no textual basis for the dip.
//  - jamaica: June's text explicitly says conditions are "calming from
//    May's peak" (i.e. improving) yet is scored LOWER than May (4.25
//    vs 5) — a direct contradiction between the claim and the number.
const KEY = 'beachesSwimming';

interface Fix {
  scores: Partial<Record<number, number>>;
  text?: Partial<Record<number, string>>;
}

const FIXES: Record<string, Fix> = {
  barbados: { scores: { 0: 9.5, 1: 9.5, 2: 9.5, 3: 9.5, 11: 9.5 } },
  'turks-caicos': { scores: { 0: 9.6, 1: 9.6, 2: 9.6, 3: 9.6 } },
  palawan: { scores: { 0: 9.7, 1: 9.7, 2: 9.7, 3: 9.7, 10: 9.5, 11: 9.5 } },
  mauritius: { scores: { 4: 9.3, 5: 9.3, 6: 9.3, 7: 9.3, 8: 9.3, 9: 9.3, 10: 8.5 } },
  borabora: { scores: { 3: 8.5, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9, 9: 9, 10: 9 } },
  maui: { scores: { 3: 9, 4: 9.3, 5: 9.6, 6: 9.6, 7: 9.6, 8: 9.6 } },
  maldives: { scores: { 0: 9.5, 1: 9.5, 2: 9.5, 3: 9.5, 11: 9.5 } },
  fiji: { scores: { 4: 9.3, 5: 9.3, 6: 9.3, 7: 9.3, 8: 9.3, 9: 9.3 } },
  bahamas: { scores: { 0: 9.6, 1: 9.6, 2: 9.6, 3: 9.6 } },
  hongkong: {
    scores: { 6: 1, 7: 1, 8: 1 },
    text: {
      6: 'Typhoon season’s peak — real storm risk on top of the heat, not just choppier water.',
      7: 'Typhoon season’s peak — real storm risk on top of the heat, not just choppier water.',
      8: 'Typhoon season’s peak — real storm risk on top of the heat, not just choppier water.',
    },
  },
  sydney: { scores: { 6: 8 } },
  jamaica: { scores: { 5: 5.5 } },
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
