import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Seventh batch — Arctic/tundra short-season destinations (Svalbard,
 * Churchill, Greenland, Finnish Lapland). Greenland was flat (base 4, no
 * birdingPeak flag, no event) despite having genuinely real content —
 * some of the largest seabird colonies on Earth (little auks by the
 * millions) form each Arctic summer. Authored a real event for it.
 * Lapland stays genuinely flat — boreal specialists are present, but
 * there's no real seasonal spectacle to hang a claim on, and forcing one
 * would be the same mistake this whole project is trying to catch.
 */

const KEY = 'birding';

const OVERVIEWS: Record<string, string> = {
  svalbard: 'Arctic seabird cliffs hold enormous colonies of little auks and Brünnich\'s guillemots during the short polar summer. Outside that window, the islands are largely inaccessible to birdlife.',
  churchill: 'Subarctic tundra and boreal forest meet here, drawing breeding shorebirds and a real diversity of northern specialists each summer.',
  greenland: 'Some of the largest seabird colonies on Earth form each summer, when little auks gather by the millions on cliff faces alongside king eiders and the elusive ivory gull.',
  lapland: 'Boreal forest specialists — three-toed woodpecker, Siberian jay, and several owl species — are present year-round, though sightings require real patience rather than concentrated spectacle.',
};

const MONTHLY: Record<string, string[]> = {
  svalbard: [
    'Outside the brief Arctic summer, the seabird colonies are empty and birdlife is minimal.', // Jan
    'Outside the brief Arctic summer, the seabird colonies are empty and birdlife is minimal.', // Feb
    'Outside the brief Arctic summer, the seabird colonies are empty and birdlife is minimal.', // Mar
    'Outside the brief Arctic summer, the seabird colonies are empty and birdlife is minimal.', // Apr
    'Outside the brief Arctic summer, the seabird colonies are empty and birdlife is minimal.', // May
    'Arctic seabird colonies are active during the short polar summer, with little auks and Brünnich\'s guillemots packed onto cliff ledges.', // Jun
    'Arctic seabird colonies are active during the short polar summer, with little auks and Brünnich\'s guillemots packed onto cliff ledges.', // Jul
    'Arctic seabird colonies are active during the short polar summer, with little auks and Brünnich\'s guillemots packed onto cliff ledges.', // Aug
    'Outside the brief Arctic summer, the seabird colonies are empty and birdlife is minimal.', // Sep
    'Outside the brief Arctic summer, the seabird colonies are empty and birdlife is minimal.', // Oct
    'Outside the brief Arctic summer, the seabird colonies are empty and birdlife is minimal.', // Nov
    'Outside the brief Arctic summer, the seabird colonies are empty and birdlife is minimal.', // Dec
  ],
  churchill: [
    'Outside the summer breeding window, birdlife settles to a quieter baseline.', // Jan
    'Outside the summer breeding window, birdlife settles to a quieter baseline.', // Feb
    'Outside the summer breeding window, birdlife settles to a quieter baseline.', // Mar
    'Outside the summer breeding window, birdlife settles to a quieter baseline.', // Apr
    'Outside the summer breeding window, birdlife settles to a quieter baseline.', // May
    'Peak breeding season for tundra and boreal specialists, including shorebirds nesting on the open tundra.', // Jun
    'Peak breeding season for tundra and boreal specialists, including shorebirds nesting on the open tundra.', // Jul
    'Outside the summer breeding window, birdlife settles to a quieter baseline.', // Aug
    'Outside the summer breeding window, birdlife settles to a quieter baseline.', // Sep
    'Outside the summer breeding window, birdlife settles to a quieter baseline.', // Oct
    'Outside the summer breeding window, birdlife settles to a quieter baseline.', // Nov
    'Outside the summer breeding window, birdlife settles to a quieter baseline.', // Dec
  ],
  greenland: [
    'Outside the short Arctic summer, seabird colonies are empty and birdlife settles to a quiet baseline.', // Jan
    'Outside the short Arctic summer, seabird colonies are empty and birdlife settles to a quiet baseline.', // Feb
    'Outside the short Arctic summer, seabird colonies are empty and birdlife settles to a quiet baseline.', // Mar
    'Outside the short Arctic summer, seabird colonies are empty and birdlife settles to a quiet baseline.', // Apr
    'Outside the short Arctic summer, seabird colonies are empty and birdlife settles to a quiet baseline.', // May
    'Arctic seabird colonies are at their peak, with little auks gathering by the millions alongside king eiders.', // Jun
    'Arctic seabird colonies are at their peak, with little auks gathering by the millions alongside king eiders.', // Jul
    'Arctic seabird colonies are at their peak, with little auks gathering by the millions alongside king eiders.', // Aug
    'Outside the short Arctic summer, seabird colonies are empty and birdlife settles to a quiet baseline.', // Sep
    'Outside the short Arctic summer, seabird colonies are empty and birdlife settles to a quiet baseline.', // Oct
    'Outside the short Arctic summer, seabird colonies are empty and birdlife settles to a quiet baseline.', // Nov
    'Outside the short Arctic summer, seabird colonies are empty and birdlife settles to a quiet baseline.', // Dec
  ],
  lapland: Array(12).fill('Boreal forest specialists remain present through the year; nothing here is tied to a specific seasonal spectacle.'),
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try { raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8'); } catch { return out; }
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
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  // Author Greenland's real seabird-colony event first.
  {
    const [row] = await db.select().from(places).where(eq(places.id, 'greenland'));
    const scoring = toScoringPlace(row);
    const base = scoring.base[KEY]; // 4
    const target = 7;
    const events = [{ label: 'Arctic seabird colonies (little auks)', weight: target - base, months: { 6: 1, 7: 1, 8: 1 } }];
    const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: events } };
    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const fit = fitMonthlyToCurve(monthly[KEY], { maxSteepness: 4, errorTolerance: 0.5 });
    console.log(`  greenland   new event, peak=${Math.max(...monthly[KEY]).toFixed(1)}  monthly=[${monthly[KEY].map((v: number) => v.toFixed(0)).join(',')}]`);
    const patch: Record<string, unknown> = {
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: events },
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, 'greenland'));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: 'greenland',
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
    };
    console.log(`  ${id}: writing overview + 12 monthly entries`);
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
