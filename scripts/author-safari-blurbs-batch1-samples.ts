import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'safari';

const OVERVIEWS: Record<string, string> = {
  kenya: 'The Great Migration\'s Mara River crossings — over a million wildebeest and zebra, with waiting crocodiles — are one of the most dramatic wildlife spectacles on Earth, running roughly July through October. Amboseli adds close, wide-open views of elephant herds against Kilimanjaro\'s backdrop, a real year-round draw independent of the migration\'s timing.',
  kaziranga: 'Kaziranga holds two-thirds of the world\'s greater one-horned rhinos, alongside wild elephants and Bengal tigers — but access is a real hard cutoff: the park is closed to visitors during the monsoon floods (roughly May through September), reopening once the water recedes. Controlled grass-burning (typically February-April) strips away the tall elephant grass that hides wildlife the rest of the year.',
  pantanal: 'The Pantanal is the most reliable place on Earth to see wild jaguars — Porto Jofre, in the northern Pantanal, offers 80-95% sighting odds on a multi-day river safari during the dry season, when shrinking water concentrates prey along the riverbanks.',
  ghana: 'Mole National Park, Ghana\'s largest wildlife reserve, is genuinely unusual for offering guided walking safaris — on foot, with armed rangers — rather than vehicle-based game drives. Free-ranging elephants are the highlight, but nothing here matches the scale of East or Southern Africa\'s parks. The dry season (November-March) is when wildlife concentrates at waterholes and roads are passable; the rains make both harder.',
};

const MONTHLY: Record<string, string[]> = {
  kenya: [
    'Kenya\'s short dry season — excellent game viewing across the Mara and Amboseli before the long rains begin.',
    'Kenya\'s short dry season — excellent game viewing across the Mara and Amboseli before the long rains begin.',
    'The long rains are beginning — the Mara and Amboseli remain excellent, just with muddier roads.',
    'The long rains continue — the Mara and Amboseli remain excellent, just with muddier roads.',
    'The long rains are easing — the Mara and Amboseli remain excellent, just with muddier roads.',
    'The Great Migration herds are arriving in the Mara ecosystem, building toward the river crossings.',
    'Peak Mara River crossing season — one of the most dramatic wildlife spectacles on Earth, with wildebeest and zebra crossing crocodile-filled waters by the hundreds of thousands.',
    'Peak Mara River crossing season continues.',
    'Still peak Mara River crossing season.',
    'The river crossings continue as the herds begin their return south.',
    'The short rains bring a brief refresh — the Mara and Amboseli remain excellent.',
    'Kenya\'s short dry season returns — excellent game viewing across the Mara and Amboseli.',
  ],
  kaziranga: [
    'Peak dry season at Kaziranga — cool, clear conditions with excellent visibility.',
    'Controlled grass-burning strips away the tall elephant grass, opening up some of the clearest sightlines of the year.',
    'Still within the burned-grass window at Kaziranga, excellent visibility continuing.',
    'The last weeks before the park closes for monsoon season — visibility remains good.',
    'Kaziranga is closed to visitors — the monsoon floods make the park inaccessible.',
    'Kaziranga is closed to visitors — the monsoon floods make the park inaccessible.',
    'Kaziranga is closed to visitors — the monsoon floods make the park inaccessible.',
    'Kaziranga is closed to visitors — the monsoon floods make the park inaccessible.',
    'Kaziranga is closed to visitors — the monsoon floods make the park inaccessible.',
    'Kaziranga reopens as the floodwaters recede, though the tall grass hasn\'t yet been cut back.',
    'Cooler, drier conditions returning to Kaziranga as the dry season sets in.',
    'Peak dry season at Kaziranga — cool, clear conditions with excellent visibility.',
  ],
  pantanal: [
    'The wet season — water is spread across the floodplain, and jaguars are harder to find along the rivers.',
    'The wet season — water is spread across the floodplain, and jaguars are harder to find along the rivers.',
    'The wet season — water is spread across the floodplain, and jaguars are harder to find along the rivers.',
    'Water levels beginning to drop, improving jaguar sighting odds along the rivers.',
    'Water levels beginning to drop, improving jaguar sighting odds along the rivers.',
    'Water levels beginning to drop, improving jaguar sighting odds along the rivers.',
    'Peak jaguar season begins at Porto Jofre — shrinking water concentrates prey along the riverbanks.',
    'Peak jaguar season at Porto Jofre — sighting odds run 80-95% on a multi-day river safari.',
    'Still peak jaguar season at Porto Jofre.',
    'Jaguar sightings remain excellent at Porto Jofre, easing slightly as the dry season nears its end.',
    'The dry season ending — jaguar sightings become less reliable as water levels begin rising.',
    'The wet season returning — water spreads back across the floodplain, and jaguars become harder to find.',
  ],
  ghana: [
    'Peak dry season at Mole — wildlife concentrated at waterholes, roads at their most passable.',
    'Still within the dry season, excellent conditions at Mole.',
    'The dry season easing at Mole, still good conditions.',
    'The rains beginning at Mole — roads become harder going and wildlife more dispersed.',
    'The rains at Mole — roads are harder going and wildlife is more dispersed, away from the waterholes.',
    'The rains at Mole — roads are harder going and wildlife is more dispersed, away from the waterholes.',
    'The rains at Mole — roads are harder going and wildlife is more dispersed, away from the waterholes.',
    'The rains at Mole — roads are harder going and wildlife is more dispersed, away from the waterholes.',
    'The rains at Mole — roads are harder going and wildlife is more dispersed, away from the waterholes.',
    'The rains at Mole — roads are harder going and wildlife is more dispersed, away from the waterholes.',
    'The dry season returning to Mole, roads and wildlife concentration improving.',
    'Peak dry season at Mole — wildlife concentrated at waterholes, roads at their most passable.',
  ],
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
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }

    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
    };

    // Ghana: add the real dry-season event this destination was missing
    // entirely (Mole NP's rains genuinely limit access Apr-Oct; the score
    // was flat aside from a generic wet-penalty dip).
    if (id === 'ghana') {
      const scoring = toScoringPlace(row);
      const event = { label: 'Dry-season waterhole concentration (Mole NP)', weight: 2, months: { 11: 0.7, 12: 1, 1: 1, 2: 1, 3: 0.7 } };
      const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: [event] } };
      const monthly = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
      const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
      console.log(`    ghana before: [${before.map((v: number) => v.toFixed(0)).join(',')}]`);
      console.log(`    ghana after:  [${monthly.map((v: number) => v.toFixed(0)).join(',')}]`);
      const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
      patch.sliderEvents = { ...(row.sliderEvents as Record<string, unknown>), [KEY]: [event] };
      patch.sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve };
      patch.authoredCurves = Array.from(new Set([...(row.authoredCurves ?? []), KEY]));
    }

    console.log(`  ${id}`);
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
