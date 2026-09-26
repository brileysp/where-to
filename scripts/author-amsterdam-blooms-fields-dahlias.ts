import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { scorePlace } from '../src/lib/db/queries/places';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// Amsterdam's wildflowerBlooms was Keukenhof-only, missing two real
// things (flagged directly by the user this session):
//
//  1. The Bollenstreek's DAHLIA FESTIVAL (roughly Aug 1 - Oct 11, peak
//     late Aug into Sept) was entirely absent — Jun-Dec was one flat
//     "Keukenhof closed for the season" block. Scored below tulip
//     season (real, but a regional second act, not globally iconic
//     the way Keukenhof is).
//  2. The open-air bulb FIELDS (Bollenstreek around Lisse/Hillegom/
//     Noordwijkerhout, and Flevoland's Noordoostpolder) were never
//     mentioned at all — every month's text talked only about the
//     ticketed Keukenhof garden. Real research this session: field
//     bloom actually peaks slightly AFTER Keukenhof, roughly Apr 20 -
//     May 5, with any single field colorful for only 1-2 weeks before
//     being topped (cut) to redirect energy into the bulb. May was
//     scored 5.5 ("Keukenhof's final weeks") when it's actually the
//     better month for the fields themselves — raised to 7.
const KEY = 'wildflowerBlooms';
const ID = 'amsterdam';

const CLOSED_TEXT = "Outside both of the region's flower seasons — Keukenhof closed, and outside the Bollenstreek's dahlia season too.";

const SCORES: Record<number, number> = {
  0: 2, 1: 2, 5: 2, 6: 2, 10: 2, 11: 2, // Jan/Feb/Jun/Jul/Nov/Dec — unchanged value, reworded text
  4: 7, // May — raised: real field peak overlaps here, not just Keukenhof's closing weeks
  7: 6, // Aug — dahlia season beginning
  8: 7.5, // Sep — peak dahlia season
  9: 5.5, // Oct — dahlia season fading
};

const TEXT: Record<number, string> = {
  0: CLOSED_TEXT,
  1: CLOSED_TEXT,
  2: "Keukenhof opens for its short spring season, tulips building toward peak — the outdoor bulb fields aren't yet showing much color this early.",
  3: 'Peak tulip season — Keukenhof’s seven million bulbs in bloom, alongside the first of the outdoor bulb fields (mainly the Bollenstreek) coming into brilliant color, arguably the more dramatic of the two, though each field only holds its color for a week or two before being topped for bulb production.',
  4: 'Keukenhof’s final weeks, but this is often the better month for the outdoor bulb fields themselves — the Bollenstreek and Flevoland’s Noordoostpolder typically peak in the last ten days of April into the first days of May, though exact timing shifts with the weather each year.',
  5: CLOSED_TEXT,
  6: CLOSED_TEXT,
  7: 'Dahlia season beginning across the Bollenstreek’s pick-your-own gardens and festival route, though Keukenhof itself stays closed.',
  8: 'Peak dahlia season in the Bollenstreek — the region’s second flower spectacle, distinct from and smaller than the spring tulip display.',
  9: 'Dahlia season fading as the festival winds down (it typically runs into mid-October), though Keukenhof remains closed.',
  10: CLOSED_TEXT,
  11: CLOSED_TEXT,
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

  const rows = await db.select().from(places).where(eq(places.id, ID));
  const row = rows[0];
  if (!row) { console.error(`${ID}: not found`); process.exit(1); }

  const scoreOverridesBefore = (row.scoreOverrides as Record<string, Record<number, number>>) || {};
  const scored = scorePlace(row);
  const live = scored.monthly[KEY];

  const finalOverride: Record<number, number> = { ...(scoreOverridesBefore[KEY] || {}) };
  for (const [idxStr, val] of Object.entries(SCORES)) finalOverride[Number(idxStr)] = val;

  const mw = [...((row.sliderMonthlyWeather as Record<string, (string | null)[]>)?.[KEY] || new Array(12).fill(null))];
  for (const [idxStr, text] of Object.entries(TEXT)) mw[Number(idxStr)] = text;

  const patch: Record<string, unknown> = {
    scoreOverrides: { ...scoreOverridesBefore, [KEY]: finalOverride },
    sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: mw },
  };

  console.log(`\n${row.name} (${ID})`);
  for (let i = 0; i < 12; i++) {
    const before = live[i];
    const after = finalOverride[i] ?? before;
    console.log(`  ${MONTH_NAMES[i].padEnd(10)} ${before} -> ${after}\n    ${mw[i]}`);
  }

  if (!dryRun) {
    const after = { ...row, ...patch };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, ID));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000',
        entityType: 'destination',
        entityId: ID,
        action: 'update',
        beforeValue: row,
        afterValue: after,
      });
    });
  }

  console.log(dryRun ? '\n\ndry run — nothing written.' : '\n\ndone — written to scoreOverrides / sliderMonthlyWeather.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
