import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'diving';

// Diving audit vs Bluewater Dive Travel. Most of these destinations
// already had accurate, specific overview/monthly text describing a real
// seasonal wildlife phenomenon — the SCORE just had no event attached, so
// it stayed flat regardless (the same bug class as Amsterdam's tulips).
// A few had text that was actually wrong or missing a real fact; those get
// content fixes too, noted per-destination below.
//
// Mechanical note: the swim formula's event branch auto-reapplies a -2 wet
// penalty whenever an event's bonus stays <=0 in a wet-flagged month, but
// does NOT auto-reapply dry/hazard/cold — so every new event below
// explicitly preserves dry/hazard/cold from the destination's existing
// flags (only wet is left to the automatic fallback) to avoid silently
// erasing e.g. a real hurricane-season hazard penalty.

type Entry = { label: string; weight: number; months: Record<number, number> };

const EVENTS: Record<string, Entry[]> = {
  seychelles: [{ label: 'Whale shark season', weight: 1, months: { 4: 1, 5: 1, 8: 0.5, 9: 0.7, 10: 1, 11: 1 } }],
  tanzania: [{ label: 'Whale shark season (Mnemba Atoll)', weight: 1, months: { 1: 0.5, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 0.5, 12: 0.5 } }],
  madagascar: [{ label: 'Whale shark season (Nosy Be)', weight: 1, months: { 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1.5, 11: 0.5 } }],
  azores: [{ label: 'Blue/mako shark season', weight: 1, months: { 7: 1, 8: 1, 9: 1, 10: 0.5 } }],
  bahamas: [{ label: 'Tiger Beach & Cat Island shark seasons', weight: 1, months: { 1: 1.5, 2: 1, 3: 1, 4: 1.5, 5: 1, 6: -0.5, 8: -5, 9: -5, 10: -5, 11: 0.5, 12: 1.5 } }],
  borneo: [{ label: 'Sipadan closure & monsoon visibility', weight: 1, months: { 1: -5, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: -6, 12: -5 } }],
  komodo: [{ label: 'South Komodo cold-water pelagic season (Manta Alley)', weight: 1, months: { 1: 1, 2: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1.5 } }],
  palawan: [{ label: 'Tubbataha Reef liveaboard season', weight: 1, months: { 1: 1, 2: 1, 3: 1, 4: 1.5, 5: 0.5, 7: -5, 8: -5, 9: -5, 11: 1, 12: 1 } }],
  'papua-new-guinea': [{ label: 'Milne Bay season', weight: 1, months: { 9: 0.5, 10: 1, 11: 1, 12: 1, 1: 1, 2: 1, 3: 0.5, 5: -2, 6: -2, 7: -2, 8: -2 } }],
  fiji: [{ label: 'Dive season & cyclone risk', weight: 1, months: { 1: -5, 2: -5, 3: -5, 4: 1, 5: 1, 6: 1, 7: 1.5, 8: 1, 9: 1.5, 10: 1 } }],
  okinawa: [{ label: 'Typhoon disruption & shoulder seasons', weight: 1, months: { 1: 1, 2: 1, 3: 1, 4: 0.5, 8: -5, 9: -4.5, 10: 1, 11: 1, 12: 1 } }],
  'turks-caicos': [{ label: 'Humpback whale migration (the Wall)', weight: 1, months: { 1: 1, 2: 1.5, 3: 1.5, 4: 1, 8: -5, 9: -5, 10: -5, 12: 1 } }],
  mauritius: [{ label: 'Cyclone & monsoon-wind seasons', weight: 1, months: { 3: 0.5, 4: 0.5, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1.5 } }],
  thailand: [{ label: 'Similan Islands closure (mid-May to mid-Oct)', weight: 1, months: { 1: 1, 2: 1, 6: -6, 7: -6, 8: -6, 9: -6, 10: -5, 11: 1, 12: 1 } }],
  egypt: [{ label: 'Shoulder-season calm window', weight: 1, months: { 3: 1, 4: 1, 5: 1, 9: 1, 10: 1, 11: 1 } }],
  palau: [{ label: 'Dry-season calm window', weight: 2, months: { 10: 1, 11: 1, 12: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 } }],
  maldives: [
    { label: 'Dry NE-monsoon window', weight: 2, months: { 1: 1, 2: 1, 3: 1, 4: 1, 12: 1 } },
    { label: 'Hanifaru Bay manta/whale-shark aggregation', weight: 1, months: { 5: 0.4, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 0.7, 11: 0.4 } },
  ],
};

// Content-only fixes: destinations whose overview/monthly text was
// actually wrong or missing a real fact, not just under-scored.
const OVERVIEWS: Record<string, string> = {
  borneo: "Sipadan is one of the most famous dive sites on Earth — a sheer wall dropping 600 meters, with resident green and hawksbill turtles, schooling barracuda, and white-tip reef sharks. Access is permit-limited to about 120 divers a day, and the island closes to ALL divers entirely every November for conservation. There's no accommodation on Sipadan itself either way — everyone stays on nearby Mabul or Kapalai.",
  madagascar: "Nosy Be, off the northwest coast, has real coral reef diving and a genuine whale shark season — Sep-Dec, peaking Oct-Nov — a marine complement to the country's famous lemur trekking, in a different part of the island entirely.",
  komodo: "Komodo's diving is defined by strong currents and a real temperature gradient across a small area — warmer water and mantas in the north, colder, nutrient-rich water in the south at sites like Manta Alley, where a genuine cold-water pelagic season (Dec-Feb) draws bigger, different marine life than the rest of the year. It's current-driven drift diving throughout, better suited to experienced divers.",
  'papua-new-guinea': 'PNG is genuinely remote, liveaboard-and-resort-based diving in some of the least-touristed reefs left in the world. Milne Bay is the specialty: "muck diving" over sandy, silty bottoms that turn up bizarre, rarely-seen critters most reef divers never see — best Oct-Mar, with a manta season starting in September; May-Aug rain noticeably degrades the visibility this style of diving depends on.',
  'turks-caicos': 'The wall — a dramatic drop-off close to shore around Grace Bay and Grand Turk — is the signature feature, along with consistently clear, calm water. North Atlantic humpback whales migrate directly past Grand Turk and Salt Cay late Jan-early Apr, close enough to the Wall dive sites that a local operator is named for it. The real variable the rest of the year is hurricane season.',
  mauritius: "Diving here mixes coral reef, wrecks, and drop-offs along the lagoon's outer edge, with dolphins a regular sighting on the west coast. Conditions are genuinely two-part: cyclone risk Jan-Mar, then SE monsoon winds through much of May-Oct that make a lot of sites hard to reach — the real best windows are narrower than either season alone, roughly Oct-Dec and Mar-Apr.",
};

const MONTHLY: Record<string, string[]> = {
  borneo: [
    'The northeast monsoon brings rough seas and low visibility around Sipadan and Mabul.',
    'Still within the rougher monsoon stretch, though conditions are transitioning.',
    "Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan's wall.",
    "Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan's wall.",
    "Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan's wall.",
    "Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan's wall.",
    "Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan's wall.",
    "Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan's wall.",
    "Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan's wall.",
    "Calm seas and excellent visibility for most of the year — the reliable stretch for diving Sipadan's wall.",
    'Sipadan is closed entirely to all divers this month for conservation — no exceptions, regardless of conditions.',
    'The northeast monsoon returns, bringing rough seas and low visibility.',
  ],
  madagascar: [
    'Cyclone season — the least reliable stretch of the year.',
    'Cyclone season — the least reliable stretch of the year.',
    'Cyclone season — the least reliable stretch of the year.',
    'Conditions are improving.',
    'The dry season is underway — good diving conditions, though whale sharks have not arrived yet.',
    'The dry season — good diving conditions, though whale sharks have not arrived yet.',
    'The dry season — good diving conditions, though whale sharks have not arrived yet.',
    'The dry season — good diving conditions, though whale sharks have not arrived yet.',
    'Whale shark season beginning — the best diving conditions of the year, building toward peak.',
    'Peak whale shark season at Nosy Be.',
    'Whale shark season continues, easing toward its end.',
    'Whale shark season has ended and cyclone risk returns.',
  ],
  komodo: [
    "The cold-water pelagic season in the south (Manta Alley) — a real, different specialty from the rest of the year, alongside the wet season's rain and rougher crossings elsewhere.",
    "The cold-water pelagic season in the south (Manta Alley) continues, alongside the wet season's rain and rougher crossings elsewhere.",
    'The wet season — rain and rougher crossings make conditions less reliable, and the south\'s cold-water season has ended.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    'The dry season — calm seas and reliable, current-driven diving throughout the park.',
    "The dry season continues, and the south's cold-water pelagic season is beginning again.",
  ],
  'papua-new-guinea': [
    'Within Milne Bay\'s real peak season — muck diving at its best.',
    'Within Milne Bay\'s real peak season — muck diving at its best.',
    "Still within Milne Bay's peak season, easing toward the rainier months.",
    'Conditions transitioning.',
    'Rain noticeably degrades muck-diving visibility — the least reliable stretch of the year, despite what generic dry-season weather patterns elsewhere might suggest.',
    'Rain noticeably degrades muck-diving visibility — the least reliable stretch of the year.',
    'Rain noticeably degrades muck-diving visibility — the least reliable stretch of the year.',
    'Rain noticeably degrades muck-diving visibility — the least reliable stretch of the year.',
    "Manta season begins at Milne Bay, and conditions are recovering.",
    "Milne Bay's real peak season — the most reliable muck diving of the year.",
    "Milne Bay's real peak season continues.",
    "Milne Bay's real peak season continues.",
  ],
  'turks-caicos': [
    'Dry season, calm and clear — and within the humpback whale migration past Grand Turk and Salt Cay.',
    'Dry season, calm and clear — peak humpback whale season along the Wall.',
    'Dry season, calm and clear — peak humpback whale season along the Wall.',
    'Still good, and the tail end of humpback whale season, easing as hurricane season begins.',
    'Still good, easing as hurricane season begins.',
    'Hurricane season is underway; conditions are less consistent.',
    'Hurricane season is underway; conditions are less consistent.',
    'Peak hurricane risk — the least reliable stretch of the year, with real potential for trip disruption.',
    'Peak hurricane risk — the least reliable stretch of the year, with real potential for trip disruption.',
    'Peak hurricane risk — the least reliable stretch of the year, with real potential for trip disruption.',
    'Conditions are recovering as hurricane season ends.',
    'Back to calm, clear dry-season conditions, with humpback whales beginning to arrive.',
  ],
  mauritius: [
    'Cyclone season — the least reliable stretch of the year.',
    'Cyclone season — the least reliable stretch of the year.',
    'One of the two real best windows — cyclone risk easing, monsoon winds not yet a factor.',
    'One of the two real best windows — clear of both cyclone risk and monsoon winds.',
    'SE monsoon winds are picking up, making some sites harder to reach.',
    'SE monsoon winds make a number of sites difficult or impossible to reach.',
    'SE monsoon winds make a number of sites difficult or impossible to reach.',
    'SE monsoon winds make a number of sites difficult or impossible to reach.',
    'SE monsoon winds make a number of sites difficult or impossible to reach.',
    'The monsoon winds are easing — one of the two real best windows beginning.',
    'One of the two real best windows — calm, accessible conditions across most sites.',
    'Cyclone risk is building again.',
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

  for (const id of Object.keys(EVENTS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const scoring = toScoringPlace(row);
    const before = deriveDestinationScores(scoring, { skipHazards: true }).monthly[KEY];
    const patchedScoring = { ...scoring, sliderEvents: { ...(scoring.sliderEvents ?? {}), [KEY]: EVENTS[id] } };
    const after = deriveDestinationScores(patchedScoring, { skipHazards: true }).monthly[KEY];
    console.log(`${id}`);
    console.log(`  before: [${before.map((v: number) => v.toFixed(0)).join(',')}]`);
    console.log(`  after:  [${after.map((v: number) => v.toFixed(0)).join(',')}]`);

    const fit = fitMonthlyToCurve(after, { maxSteepness: 4, errorTolerance: 0.5 });
    const patch: Record<string, unknown> = {
      sliderEvents: { ...(row.sliderEvents as Record<string, unknown>), [KEY]: EVENTS[id] },
      sliderCurves: { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve },
      authoredCurves: Array.from(new Set([...(row.authoredCurves ?? []), KEY])),
    };
    if (OVERVIEWS[id]) {
      patch.sliderOverview = { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] };
      patch.sliderMonthlyWeather = { ...(row.sliderMonthlyWeather as Record<string, unknown>), [KEY]: MONTHLY[id] };
    }

    if (!dryRun) {
      const afterRow = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: afterRow,
        });
      });
    }
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
