import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

// Cross-check pass: comparing wildlifeViewing (just audited) against its
// two sibling "wildlife formula" cousins that share the same real-world
// phenomena — whaleWatching and birding — for destinations where both
// sliders author events about the same animal/site. Surfaced three
// confirmed, previously-unpropagated bugs (the same tier-inversion pattern
// already fixed on safari and wildlifeViewing's Rwanda event, still present
// unfixed on birding's Rwanda event; Hokkaido's crane widening fixed on
// wildlifeViewing but not birding) plus gaps introduced by this session's
// own wildlifeViewing fixes (Monterey's gray whale event was missing the
// southbound leg and the May northbound peak that whaleWatching's own,
// more complete event already modeled correctly) and two independent
// findings (Antarctica's WV penguin event mislabeled as whale-relevant;
// Zambia/Zimbabwe's Oct dry-season value undertiered, same as the Namibia
// fix, now corroborated by their own birding content's Hwange/Carmine
// bee-eater "peak" framing).

type Event = { label: string; weight: number; months: Record<number, number> };

const EVENTS: Record<string, Record<string, Event[]>> = {
  hokkaido: {
    birding: [
      { label: 'Red-crowned crane viewing (Kushiro)', weight: 2, months: { 12: 0.6, 1: 1, 2: 1, 3: 0.6 } },
    ],
  },
  rwanda: {
    birding: [
      { label: 'Dry-season forest access (Albertine Rift endemics)', weight: 1, months: { 1: 0.6, 2: 0.6, 6: 1, 7: 1, 8: 1, 9: 0.6, 12: 0.6 } },
    ],
  },
  'monterey-big-sur': {
    wildlifeViewing: [
      { label: 'Elephant seal pupping season (Año Nuevo)', weight: 5, months: { 12: 0.7, 1: 1, 2: 0.7 } },
      { label: 'Gray whale migration (southbound Dec-Jan, northbound Mar-May)', weight: 4, months: { 12: 0.4, 1: 0.3, 3: 0.6, 4: 1, 5: 1 } },
    ],
  },
  antarctica: {
    wildlifeViewing: [
      { label: 'Penguin chicks hatching & seals hauled out on retreating ice', weight: 2, months: { 1: 1, 2: 0.85, 3: 0.85, 11: 0.5, 12: 1 } },
    ],
  },
  zambia: {
    wildlifeViewing: [
      { label: 'Dry-season concentration', weight: 3.5, months: { 5: 0.3, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 0.85 } },
    ],
  },
  zimbabwe: {
    wildlifeViewing: [
      { label: "Dry-season concentration at Hwange's waterholes", weight: 3.5, months: { 5: 0.3, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 0.85 } },
    ],
  },
};

const OVERVIEWS: Record<string, Record<string, string>> = {
  hokkaido: {
    birding: "Red-crowned cranes gather at winter feeding stations near Kushiro, one of the most reliable large-bird spectacles in Japan — real numbers build from December and hold through March, not just a brief January-February window.",
  },
  'monterey-big-sur': {
    wildlifeViewing: "Año Nuevo's elephant seal colony is a genuinely dramatic, reliable sighting during the winter breeding season — peak births are in January, with males fighting for territory and pups born on the beach. Gray whales pass twice a year: a smaller southbound push past the headlands in December and January, overshadowed by the seal spectacle, then the more visible northbound migration each spring, mothers and calves passing especially close to shore, peaking in April and May.",
  },
};

const MONTHLY: Record<string, Record<string, string[]>> = {
  hokkaido: {
    birding: [
      'Red-crowned cranes gather at winter feeding stations near Kushiro, at their most reliable and visible.',
      'Red-crowned cranes remain at the feeding stations at full numbers — still peak season, not an easing tail.',
      'Cranes remain visible near Kushiro as the season winds down toward dispersal.',
      'Outside the winter crane season, birding settles to a common baseline.',
      'Outside the winter crane season, birding settles to a common baseline.',
      'Outside the winter crane season, birding settles to a common baseline.',
      'Outside the winter crane season, birding settles to a common baseline.',
      'Outside the winter crane season, birding settles to a common baseline.',
      'Outside the winter crane season, birding settles to a common baseline.',
      'Outside the winter crane season, birding settles to a common baseline.',
      'Outside the winter crane season, birding settles to a common baseline.',
      'Red-crowned cranes are gathering at the winter feeding stations near Kushiro as the season begins.',
    ],
  },
  rwanda: {
    birding: [
      'The short dry season here — firmer trail access than the rains, but not as reliably dry as June through August; the same endemic species remain present regardless.',
      'The short dry season here — firmer trail access than the rains, but not as reliably dry as June through August; the same endemic species remain present regardless.',
      'Wetter conditions make forest trails harder going, though the same endemic species remain present.',
      'Wetter conditions make forest trails harder going, though the same endemic species remain present.',
      'Wetter conditions make forest trails harder going, though the same endemic species remain present.',
      'Peak dry-season trail access into Nyungwe Forest, on par with July and August.',
      'Peak dry-season trail access into Nyungwe Forest, where the Albertine Rift’s endemic-rich birdlife concentrates.',
      'Peak dry-season trail access into Nyungwe Forest, where the Albertine Rift’s endemic-rich birdlife concentrates.',
      'Still within the dry season, easing slightly.',
      'Wetter conditions make forest trails harder going, though the same endemic species remain present.',
      'Wetter conditions make forest trails harder going, though the same endemic species remain present.',
      'The short dry season returning — firmer trail access than the rains, though not as reliably dry as the June-August peak.',
    ],
  },
  'monterey-big-sur': {
    wildlifeViewing: [
      'Peak elephant seal pupping season at Año Nuevo — a genuinely dramatic, reliable sighting, with males fighting for territory and pups born on the beach — alongside the smaller southbound gray whale migration passing offshore.',
      'Elephant seal pupping is easing at Año Nuevo; gray whales are largely between migrations this month, off Baja.',
      'Elephant seal pupping is easing at Año Nuevo, while the early northbound gray whale migration gets underway.',
      'Peak gray whale migration season, passing close offshore on the northbound journey; the elephant seal colony has largely thinned out.',
      'Peak gray whale migration season continues, with mothers and calves passing especially close to shore on the northbound journey.',
      'Both the elephant seal colony and the gray whale migration have moved on; wildlife-watching here is much quieter.',
      'Both the elephant seal colony and the gray whale migration have moved on; wildlife-watching here is much quieter.',
      'Both the elephant seal colony and the gray whale migration have moved on; wildlife-watching here is much quieter.',
      'Both the elephant seal colony and the gray whale migration have moved on; wildlife-watching here is much quieter.',
      'Both the elephant seal colony and the gray whale migration have moved on; wildlife-watching here is much quieter.',
      'Both the elephant seal colony and the gray whale migration have moved on; wildlife-watching here is much quieter.',
      'Elephant seal pupping season is building at Año Nuevo, alongside the start of the southbound gray whale migration passing offshore.',
    ],
  },
  zambia: {
    wildlifeViewing: [
      'Thick vegetation and dispersed wildlife make sightings, including leopards, harder to come by during the rains.',
      'Thick vegetation and dispersed wildlife make sightings, including leopards, harder to come by during the rains.',
      'Thick vegetation and dispersed wildlife make sightings, including leopards, harder to come by during the rains.',
      'Conditions are beginning to improve as the dry season approaches.',
      'Leopard and general wildlife sightings are building toward their peak.',
      'Leopard and general wildlife sightings are building toward their peak.',
      "Peak dry season — South Luangwa's leopard odds, among the best in Africa, are at their strongest, alongside concentrated general wildlife.",
      "Peak dry season — South Luangwa's leopard odds, among the best in Africa, are at their strongest, alongside concentrated general wildlife.",
      "Peak dry season — South Luangwa's leopard odds, among the best in Africa, are at their strongest, alongside concentrated general wildlife.",
      'Still within the dry-season peak — waterhole concentrations remain close to their strongest as the season nears its end.',
      'Rains are returning; thick vegetation makes sightings, including leopards, harder to come by.',
      'Rains are returning; thick vegetation makes sightings, including leopards, harder to come by.',
    ],
  },
  zimbabwe: {
    wildlifeViewing: [
      "Rains disperse wildlife across a wider area; elephant and lion sightings at Hwange's waterholes are less concentrated.",
      "Rains disperse wildlife across a wider area; elephant and lion sightings at Hwange's waterholes are less concentrated.",
      "Rains disperse wildlife across a wider area; elephant and lion sightings at Hwange's waterholes are less concentrated.",
      'Waterhole concentrations are beginning to build as the dry season approaches.',
      "Elephant and lion sightings at Hwange's waterholes are building toward their peak.",
      "Elephant and lion sightings at Hwange's waterholes are building toward their peak.",
      "Peak dry season — elephant herds are a near-certain sighting at Hwange's waterholes, alongside reliable lion sightings.",
      "Peak dry season — elephant herds are a near-certain sighting at Hwange's waterholes, alongside reliable lion sightings.",
      "Peak dry season — elephant herds are a near-certain sighting at Hwange's waterholes, alongside reliable lion sightings.",
      "Still within the dry-season peak — waterhole concentrations remain close to their strongest as the season nears its end.",
      'Rains are returning, dispersing wildlife across a wider area.',
      'Rains are returning, dispersing wildlife across a wider area.',
    ],
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
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const [id, keyed] of Object.entries(EVENTS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }

    const patch: Record<string, unknown> = {};
    const newSliderEvents = { ...(row.sliderEvents as Record<string, unknown>) };
    for (const [key, events] of Object.entries(keyed)) newSliderEvents[key] = events;
    patch.sliderEvents = newSliderEvents;

    if (OVERVIEWS[id]) {
      const newOverview = { ...(row.sliderOverview as Record<string, string>) };
      for (const [key, text] of Object.entries(OVERVIEWS[id])) newOverview[key] = text;
      patch.sliderOverview = newOverview;
    }
    if (MONTHLY[id]) {
      const newMonthly = { ...(row.sliderMonthlyWeather as Record<string, unknown>) };
      for (const [key, arr] of Object.entries(MONTHLY[id])) {
        if (arr.length !== 12) { console.error(`${id}/${key}: bad monthly array length`); process.exit(1); }
        newMonthly[key] = arr;
      }
      patch.sliderMonthlyWeather = newMonthly;
    }

    const scoringRow = { ...row, ...patch };
    const scoring = toScoringPlace(scoringRow as typeof row);
    const newCurves = { ...(row.sliderCurves as Record<string, unknown>) };
    for (const key of Object.keys(keyed)) {
      const monthly = deriveDestinationScores(scoring, { skipHazards: true }).monthly[key];
      const fit = fitMonthlyToCurve(monthly, { maxSteepness: 4, errorTolerance: 0.5 });
      newCurves[key] = fit.curve;
      console.log(`${id}/${key}: [${monthly.map((v: number) => v.toFixed(0)).join(',')}] peak=${Math.max(...monthly)}`);
    }
    patch.sliderCurves = newCurves;

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
