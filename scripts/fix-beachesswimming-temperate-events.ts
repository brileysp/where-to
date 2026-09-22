import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * beachesSwimming survey found a cluster of temperate/cold-water coastal
 * destinations scored flat (or near-flat) across most of the year, because
 * they carry no sliderEvents and their shared dry/wet/cold climate flags
 * apparently don't distinguish a real swim season for them. Real sea/lake
 * temperature data shows every one of these has a genuinely narrower warm
 * window than the flat score implies. Fixed with ONE negative event per
 * destination, scoped to this slider only (not the shared coldMonths/
 * wetMonths flags other already-authored swim-formula sliders — surfing,
 * etc. — read for these same places), covering just the real cold/off
 * months. The genuine warm months are left untouched at their current base
 * value, which already reads as a reasonable peak.
 *
 * Sources (Sep 2026): seatemperature.net/.info, seatemperatu.re,
 * cornwall-beaches.co.uk, novascotia.com, watery.ie, isleofskye.com,
 * currentresults.com, per-destination search in this session.
 */
const KEY = 'beachesSwimming';

// IMPORTANT gotcha in the swim formula (destinations.ts): once a slider has
// ANY sliderEvents at all, every month switches to the events branch, whose
// fallback only re-checks the "wet" flag — the cold/hazard/dry checks the
// OLD (no-events) fallback used are gone for every month, not just the ones
// an event targets. Leaving a "good" month uncovered assumes it'll keep
// getting its old cold/hazard treatment; it won't. So every fix below
// covers all 12 months explicitly, with the weight needed to reach a
// researched target value — computed relative to base, verified against the
// live pipeline below (never hand-trusted), not left to the old fallback.
function allMonths(base: number, target: number[]): { label: string; weight: number; months: Record<number, number> }[] {
  const byWeight = new Map<number, number[]>();
  target.forEach((t, i) => {
    const w = t - base;
    const list = byWeight.get(w) ?? [];
    list.push(i + 1); // 1-indexed months, matching the rest of this codebase's event convention
    byWeight.set(w, list);
  });
  return [...byWeight.entries()].map(([weight, months]) => ({
    label: weight === 0 ? 'Real swim season (unchanged from base)' : 'Colder than the real peak season',
    weight,
    months: Object.fromEntries(months.map((m) => [m, 1])),
  }));
}

const FIXES: Record<string, { label: string; weight: number; months: Record<number, number> }[]> = {
  // Real season Jun-Nov (best Jul-Sep, warm well into Sep from thermal
  // lag); genuinely cold Dec-May (Feb ~48°F).
  cornwall: allMonths(5, [1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 5, 1]),
  // Real comfortable window Jun-Sep (warmest Aug); southern coast (Halifax)
  // stays 55-65°F even in "summer"; Jan/Feb coldest.
  'nova-scotia': allMonths(3, [0, 0, 1, 1, 1, 3, 3, 3, 3, 1, 1, 1]),
  // Real comfortable swimming (>65°F) is specifically Jul-Sep; spring/fall
  // run 36-61°F and 45-73°F; Jan/Feb/Dec coldest.
  'cape-cod-islands': allMonths(6, [1, 1, 2, 2, 2, 2, 6, 6, 6, 2, 2, 1]),
  // Real peak is Jul (66°F); winter drops to 43°F.
  ireland: allMonths(2, [0, 0, 0, 1, 1, 2, 2, 2, 1, 1, 0, 0]),
  // Real warmest months are Jul-Aug (~55-59°F); "conditions remain
  // challenging year-round"; Jan/Feb/Nov/Dec coldest.
  'scottish-highlands-skye': allMonths(2, [0, 0, 1, 1, 1, 2, 2, 2, 1, 1, 0, 0]),
  // Real best months Jun-Sep (warmest Aug ~63°F); never comfortable
  // without real cold tolerance; Jan/Feb/Nov/Dec coldest.
  'vancouver-island': allMonths(3, [1, 1, 2, 2, 2, 3, 3, 3, 3, 2, 1, 1]),
  // Real summer (Jun-Sep) runs 57-64°F; winter (Dec-Mar) drops to 45-52°F.
  snowdonia: allMonths(2, [0, 0, 1, 1, 1, 2, 2, 2, 2, 1, 1, 0]),
  // Same pattern as Snowdonia — English lake water warms a bit faster than
  // the sea but still peaks Jun-Sep and is genuinely cold outside it.
  'lake-district': allMonths(2, [0, 0, 1, 1, 1, 2, 2, 2, 2, 1, 1, 0]),
  // "No month is favorable" — water lags to a late-Sep peak (~57°F/14°C)
  // rather than a summer one; genuinely marginal even at its best.
  'belfast-giants-causeway': allMonths(1, [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0]),
  // Real swim season is strictly Jun-Sep (68-70°F+); Apr/May/Oct are real
  // but distinctly colder (57-62°F), hardy-swimmer territory, not the peak;
  // Jan-Mar/Nov-Dec coldest.
  'basque-country': allMonths(5, [3, 3, 3, 4, 4, 5, 5, 5, 5, 4, 3, 3]),
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
  process.env.DATABASE_URL = env.DATABASE_URL;
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');

  for (const id of Object.keys(FIXES)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const before = deriveDestinationScores(toScoringPlace(row), { skipHazards: true }).monthly[KEY] as number[];
    const patch = { sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: FIXES[id] } };
    const afterRow = { ...row, ...patch };
    const after = deriveDestinationScores(toScoringPlace(afterRow as typeof row), { skipHazards: true }).monthly[KEY] as number[];
    console.log(`${id}:\n  before [${before.join(',')}]\n  after  [${after.join(',')}]`);
    if (!dryRun) {
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id, action: 'update', beforeValue: row, afterValue: afterRow });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
