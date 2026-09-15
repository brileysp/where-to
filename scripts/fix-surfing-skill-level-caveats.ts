import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'surfing';

// User's ask: if a destination's scored "best" surf season is big/serious
// enough that it's genuinely for experienced surfers (or, for Okinawa,
// genuinely risky to plan a trip around at all) rather than something most
// visitors should paddle out into, the monthly text — not just the
// overview — needs to say so plainly. Two of these (Lisbon/Nazaré,
// Maui/Jaws) go further: those specific breaks are a watch-only spectacle
// for a handful of elite big-wave professionals, not an "experienced
// surfer" wave in the normal sense, and the old text blurred that into the
// same "biggest waves of the year" framing as every other destination.
// No score changes — content precision only.

const OVERVIEWS: Record<string, string> = {
  lisbon: "Ericeira, a short drive up the coast, is Europe's first World Surfing Reserve — a string of quality reef and point breaks that work on multiple swell directions, genuinely surfable by strong intermediate and advanced surfers. Carcavelos, right in the city, and Costa da Caparica across the river are the convenient, easy options for everyone else. Winter's Atlantic storm swell is Ericeira's real, bigger season too — but Nazaré itself, about 90 minutes further north, is a different thing entirely: some of the biggest waves ever surfed, a tow-in-only spectacle for a handful of the world's elite big-wave professionals. Nearly everyone visiting in winter should think of Nazaré as something to watch from the clifftop, not somewhere to paddle out.",
  maui: "Pe'ahi (\"Jaws\"), on the north shore, is one of the most famous big-wave breaks in the world — when winter swell is at its biggest, it's a tow-in-only spectacle for a small handful of the world's elite big-wave professionals, not somewhere the vast majority of surfers, even experienced ones, should plan to paddle out. The rest of the island stays genuinely good and far more approachable year-round: Honolua Bay picks up the same winter swell on a smaller, surfable scale, while south-shore spots near Kihei and Lahaina pick up summer's smaller south swell.",
  okinawa: "Typhoon swell genuinely produces the biggest surf here — the same storms that make early summer risky for other plans send real groundswell to Okinawa's reefs. This isn't really a \"go for the waves\" recommendation, though: storm-disruption risk (cancelled flights, dangerous seas, evacuation orders) is real and unpredictable, and most surfers, even experienced ones, are better off with the calmer, more reliable shoulder seasons.",
  'basque-country': "Mundaka, a legendary left-hand river-mouth point break, has hosted the world tour and is regularly named among the best waves in Europe — but it's a genuinely serious, advanced wave, not one for beginners or early intermediates. Its season is genuinely Oct-Feb, despite that being the region's worst general weather — the wave barely works at all in summer.",
  fiji: "Cloudbreak, a world-class reef pass wave off Tavarua, is one of the most respected big-wave breaks in the Pacific — a real World Surf League venue, and a serious, advanced wave rather than a beginner destination. The dry season's steady trade winds are what make it work; cyclone season is genuinely the wrong time to come, for safety as much as wave quality.",
  'puerto-rico': "Rincon, on the west coast, is Puerto Rico's most famous break — a real winter big-wave destination that put the island on the international surf map in the 1968 World Surfing Championships. At its biggest, it's a serious, advanced wave; summer is smaller, calmer, and far more beginner-friendly.",
  canaries: "Fuerteventura's El Cotillo is the standout — powerful, world-class reef breaks that pick up every Atlantic swell, genuinely different from the mellower summer waves elsewhere on the islands, and not a beginner destination in winter. Winter (Oct-Mar) is when it turns on properly; summer is smaller and far more forgiving.",
};

const MONTHLY: Record<string, string[]> = {
  lisbon: [
    'Winter Atlantic storm swell — Ericeira\'s real peak season for strong intermediate/advanced surfers. Nazaré is also at its biggest now, but that\'s a watch-only spectacle for nearly everyone, not a wave to paddle out on.',
    'Winter Atlantic storm swell — Ericeira\'s real peak season for strong intermediate/advanced surfers. Nazaré is also at its biggest now, but that\'s a watch-only spectacle for nearly everyone, not a wave to paddle out on.',
    'Winter Atlantic storm swell continues, same caveats as the peak winter months.',
    'Smaller, calmer spring conditions.',
    'Smaller, calmer spring conditions.',
    'Smaller, calmer summer conditions — easier and more beginner-friendly.',
    'Smaller, calmer summer conditions — easier and more beginner-friendly.',
    'Smaller, calmer summer conditions — easier and more beginner-friendly.',
    'Smaller, calmer conditions persist into early autumn.',
    'Swell building again as autumn storms arrive.',
    'Winter Atlantic storm swell returns — Ericeira\'s real peak season for strong intermediate/advanced surfers; Nazaré is a watch-only spectacle, not a wave to paddle out on.',
    'Winter Atlantic storm swell — Ericeira\'s real peak season for strong intermediate/advanced surfers. Nazaré is also at its biggest now, but that\'s a watch-only spectacle for nearly everyone, not a wave to paddle out on.',
  ],
  maui: [
    'Winter north swell — Honolua Bay picks up a smaller, genuinely surfable version; Jaws, at its biggest, is a watch-only spectacle for elite professionals, not somewhere most surfers should paddle out.',
    'Winter north swell — Honolua Bay picks up a smaller, genuinely surfable version; Jaws, at its biggest, is a watch-only spectacle for elite professionals, not somewhere most surfers should paddle out.',
    'Winter north swell continues, same caveats as the peak winter months.',
    'Smaller, still-solid conditions as winter swell eases.',
    'Smaller, still-solid conditions; summer\'s south-shore swell begins.',
    'Summer south-shore swell, smaller and more forgiving than winter.',
    'Summer south-shore swell, smaller and more forgiving than winter.',
    'Summer south-shore swell, smaller and more forgiving than winter.',
    'Summer south-shore swell, smaller and more forgiving than winter.',
    'Conditions building back up as winter approaches.',
    'Winter north swell returns — Honolua Bay is the genuinely surfable option; Jaws is a watch-only spectacle for elite professionals.',
    'Winter north swell — Honolua Bay picks up a smaller, genuinely surfable version; Jaws, at its biggest, is a watch-only spectacle for elite professionals, not somewhere most surfers should paddle out.',
  ],
  okinawa: [
    'Baseline conditions — modest, inconsistent surf.',
    'Baseline conditions — modest, inconsistent surf.',
    'Baseline conditions — modest, inconsistent surf.',
    'Baseline conditions — modest, inconsistent surf.',
    'The quietest stretch of the year for swell — real typhoon season hasn\'t arrived yet.',
    'The quietest stretch of the year for swell — real typhoon season hasn\'t arrived yet.',
    'Typhoon season beginning to build — bigger swell arriving, but this isn\'t yet, or ever really, a season to plan a trip around.',
    'Typhoon season sends real groundswell to the reefs, but this isn\'t a season to plan a surf trip around — storm-disruption risk is real and unpredictable, and most surfers are better off with the calmer shoulder seasons.',
    'Typhoon season sends real groundswell to the reefs, but this isn\'t a season to plan a surf trip around — storm-disruption risk is real and unpredictable, and most surfers are better off with the calmer shoulder seasons.',
    'Typhoon season sends real groundswell to the reefs, but this isn\'t a season to plan a surf trip around — storm-disruption risk is real and unpredictable, and most surfers are better off with the calmer shoulder seasons.',
    'Typhoon season fading, still bringing solid swell some years, with the same storm-risk caveat.',
    'Baseline conditions — modest, inconsistent surf.',
  ],
  'basque-country': [
    'Mundaka\'s season is in full swing — big, powerful, world-class waves, genuinely for advanced surfers only; winter winds can also make the estuary choppy.',
    'Mundaka\'s season is in full swing — big, powerful, world-class waves, genuinely for advanced surfers only; winter winds can also make the estuary choppy.',
    'A transitional month — Mundaka\'s autumn/winter magic hasn\'t returned and conditions are unsettled.',
    'Summer conditions are pleasant for general beach time, but Mundaka itself barely works this time of year.',
    'Summer conditions are pleasant for general beach time, but Mundaka itself barely works this time of year.',
    'Summer conditions are pleasant for general beach time, but Mundaka itself barely works this time of year.',
    'Summer conditions are pleasant for general beach time, but Mundaka itself barely works this time of year.',
    'Summer conditions are pleasant for general beach time, but Mundaka itself barely works this time of year.',
    'Mundaka\'s season returns — some of the best point-break surfing in Europe, genuinely for advanced surfers only.',
    'Mundaka\'s season returns — some of the best point-break surfing in Europe, genuinely for advanced surfers only.',
    'Mundaka\'s season returns — some of the best point-break surfing in Europe, genuinely for advanced surfers only.',
    'Mundaka\'s season returns — some of the best point-break surfing in Europe, genuinely for advanced surfers only.',
  ],
  fiji: [
    'Cyclone season — the least reliable, least safe stretch of the year.',
    'Cyclone season — the least reliable, least safe stretch of the year.',
    'Cyclone season — the least reliable, least safe stretch of the year.',
    'Conditions are turning on fast as the dry season\'s trade winds arrive.',
    'Cloudbreak\'s season — consistent trade winds and world-class waves, though this remains an advanced wave, not a beginner destination.',
    'Cloudbreak\'s season — consistent trade winds and world-class waves, though this remains an advanced wave, not a beginner destination.',
    'Cloudbreak\'s season — consistent trade winds and world-class waves, though this remains an advanced wave, not a beginner destination.',
    'Cloudbreak\'s season — consistent trade winds and world-class waves, though this remains an advanced wave, not a beginner destination.',
    'Cloudbreak\'s season — consistent trade winds and world-class waves, though this remains an advanced wave, not a beginner destination.',
    'Cloudbreak\'s season — consistent trade winds and world-class waves, though this remains an advanced wave, not a beginner destination.',
    'Conditions are easing as cyclone season approaches.',
    'Cyclone risk is building.',
  ],
  'puerto-rico': [
    'Winter north swell — Rincon\'s real season, with the biggest, most consistent waves of the year; at its biggest this is an advanced wave, not for beginners.',
    'Winter north swell — Rincon\'s real season, with the biggest, most consistent waves of the year; at its biggest this is an advanced wave, not for beginners.',
    'Winter north swell — Rincon\'s real season, with the biggest, most consistent waves of the year; at its biggest this is an advanced wave, not for beginners.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Winter north swell — Rincon\'s real season, with the biggest, most consistent waves of the year; at its biggest this is an advanced wave, not for beginners.',
    'Winter north swell — Rincon\'s real season, with the biggest, most consistent waves of the year; at its biggest this is an advanced wave, not for beginners.',
  ],
  canaries: [
    'Winter Atlantic swell season — the biggest, most powerful waves at reef breaks like El Cotillo, genuinely for experienced surfers; summer is the far more forgiving season.',
    'Winter Atlantic swell season — the biggest, most powerful waves at reef breaks like El Cotillo, genuinely for experienced surfers; summer is the far more forgiving season.',
    'Winter Atlantic swell season — the biggest, most powerful waves at reef breaks like El Cotillo, genuinely for experienced surfers; summer is the far more forgiving season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Winter swell season returns — genuinely for experienced surfers.',
    'Winter swell season returns — genuinely for experienced surfers.',
    'Winter swell season returns — genuinely for experienced surfers.',
  ],
  cornwall: [
    'Winter swell season — the biggest, most powerful waves of the year, best suited to experienced surfers; summer is the easier, more forgiving season.',
    'Winter swell season — the biggest, most powerful waves of the year, best suited to experienced surfers; summer is the easier, more forgiving season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Winter swell season — the biggest, most powerful waves of the year, best suited to experienced surfers.',
    'Winter swell season — the biggest, most powerful waves of the year, best suited to experienced surfers.',
    'Winter swell season — the biggest, most powerful waves of the year, best suited to experienced surfers.',
    'Winter swell season — the biggest, most powerful waves of the year, best suited to experienced surfers.',
  ],
  algarve: [
    'Winter Atlantic swell — the biggest waves of the year, best suited to experienced surfers; summer is calmer and better for beginners.',
    'Winter Atlantic swell — the biggest waves of the year, best suited to experienced surfers; summer is calmer and better for beginners.',
    'Winter Atlantic swell — the biggest waves of the year, best suited to experienced surfers; summer is calmer and better for beginners.',
    'Smaller, calmer summer swell, and the busiest season for beach crowds.',
    'Smaller, calmer summer swell, and the busiest season for beach crowds.',
    'Smaller, calmer summer swell, and the busiest season for beach crowds.',
    'Smaller, calmer summer swell, and the busiest season for beach crowds.',
    'Smaller, calmer summer swell, and the busiest season for beach crowds.',
    'Smaller, calmer summer swell, and the busiest season for beach crowds.',
    'Smaller, calmer summer swell, and the busiest season for beach crowds.',
    'Winter Atlantic swell — the biggest waves of the year, best suited to experienced surfers.',
    'Winter Atlantic swell — the biggest waves of the year, best suited to experienced surfers.',
  ],
  panama: [
    'Dry season — calmer, smaller, more beginner-friendly conditions.',
    'Dry season — calmer, smaller, more beginner-friendly conditions.',
    'Dry season — calmer, smaller, more beginner-friendly conditions.',
    'Wet season swell — the more consistent window for Santa Catalina, a wave that draws experienced surfers specifically.',
    'Wet season swell — the more consistent window for Santa Catalina, a wave that draws experienced surfers specifically.',
    'Wet season swell — the more consistent window for Santa Catalina, a wave that draws experienced surfers specifically.',
    'Wet season swell — the more consistent window for Santa Catalina, a wave that draws experienced surfers specifically.',
    'Wet season swell — the more consistent window for Santa Catalina, a wave that draws experienced surfers specifically.',
    'Wet season swell — the more consistent window for Santa Catalina, a wave that draws experienced surfers specifically.',
    'Wet season swell — the more consistent window for Santa Catalina, a wave that draws experienced surfers specifically.',
    'A brief, less reliable transitional stretch.',
    'Dry season conditions return.',
  ],
  'cape-town': [
    'Summer — calmer, smaller, easier conditions, good for beginners at Muizenberg.',
    'Summer — calmer, smaller, easier conditions, good for beginners at Muizenberg.',
    'Summer — calmer, smaller, easier conditions, good for beginners at Muizenberg.',
    'Winter swell season — the best window for serious point breaks like Jeffreys Bay, genuinely for experienced surfers; Muizenberg stays the easier, beginner-friendly option.',
    'Winter swell season — the best window for serious point breaks like Jeffreys Bay, genuinely for experienced surfers; Muizenberg stays the easier, beginner-friendly option.',
    'Winter swell season — the best window for serious point breaks like Jeffreys Bay, genuinely for experienced surfers; Muizenberg stays the easier, beginner-friendly option.',
    'Winter swell season — the best window for serious point breaks like Jeffreys Bay, genuinely for experienced surfers; Muizenberg stays the easier, beginner-friendly option.',
    'Winter swell season — the best window for serious point breaks like Jeffreys Bay, genuinely for experienced surfers; Muizenberg stays the easier, beginner-friendly option.',
    'Winter swell season — the best window for serious point breaks like Jeffreys Bay, genuinely for experienced surfers; Muizenberg stays the easier, beginner-friendly option.',
    'Summer — calmer, smaller, easier conditions, good for beginners at Muizenberg.',
    'Summer — calmer, smaller, easier conditions, good for beginners at Muizenberg.',
    'Summer — calmer, smaller, easier conditions, good for beginners at Muizenberg.',
  ],
  'los-cabos': [
    'Baseline conditions — modest, inconsistent surf.',
    'Baseline conditions — modest, inconsistent surf.',
    "Costa Azul's groundswell turning more consistent, ahead of hurricane season proper.",
    'Hurricane-season south swell — the more consistent window for Costa Azul, a wave suited to intermediate and advanced surfers, with April-May typically the most reliable groundswell.',
    'Hurricane-season south swell — the more consistent window for Costa Azul, a wave suited to intermediate and advanced surfers, with April-May typically the most reliable groundswell.',
    'Hurricane-season south swell — the more consistent window for Costa Azul, a wave suited to intermediate and advanced surfers.',
    'Hurricane-season south swell — the more consistent window for Costa Azul, a wave suited to intermediate and advanced surfers.',
    'Hurricane-season south swell — the more consistent window for Costa Azul, a wave suited to intermediate and advanced surfers.',
    'Hurricane-season south swell — the more consistent window for Costa Azul, a wave suited to intermediate and advanced surfers.',
    'Hurricane-season south swell — the more consistent window for Costa Azul, a wave suited to intermediate and advanced surfers.',
    'Baseline conditions — modest, inconsistent surf.',
    'Baseline conditions — modest, inconsistent surf.',
  ],
  'big-island': [
    'Winter north swell — the bigger, more consistent season; Honoli\'i is best suited to intermediate-plus surfers, with summer the easier option.',
    'Winter north swell — the bigger, more consistent season; Honoli\'i is best suited to intermediate-plus surfers, with summer the easier option.',
    'Winter north swell — the bigger, more consistent season; Honoli\'i is best suited to intermediate-plus surfers, with summer the easier option.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Smaller, calmer summer swell — the easier, more beginner-friendly season.',
    'Winter north swell — the bigger, more consistent season; best suited to intermediate-plus surfers.',
    'Winter north swell — the bigger, more consistent season; best suited to intermediate-plus surfers.',
  ],
  barbados: [
    'Winter groundswell — the Soup Bowl\'s real season, though this reef break is best left to experienced surfers.',
    'Winter groundswell — the Soup Bowl\'s real season, though this reef break is best left to experienced surfers.',
    'Winter groundswell — the Soup Bowl\'s real season, though this reef break is best left to experienced surfers.',
    'Conditions are easing.',
    'Conditions are easing.',
    'Hurricane season — the least reliable, least consistent stretch of the year.',
    'Hurricane season — the least reliable, least consistent stretch of the year.',
    'Hurricane season — the least reliable, least consistent stretch of the year.',
    'Hurricane season — the least reliable, least consistent stretch of the year.',
    'Hurricane season — the least reliable, least consistent stretch of the year.',
    'Winter groundswell — the Soup Bowl\'s real season, though this reef break is best left to experienced surfers.',
    'Winter groundswell — the Soup Bowl\'s real season, though this reef break is best left to experienced surfers.',
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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const missing: string[] = [];
  for (const id of Object.keys(MONTHLY)) {
    if (MONTHLY[id].length !== 12) missing.push(id);
  }
  if (missing.length) { console.error('Bad monthly arrays:', missing); process.exit(1); }

  for (const id of Object.keys(MONTHLY)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }

    const patch: Record<string, unknown> = {
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, unknown>), [KEY]: MONTHLY[id] },
    };
    if (OVERVIEWS[id]) {
      patch.sliderOverview = { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] };
    }
    console.log(`  ${id}${OVERVIEWS[id] ? ' (overview + monthly)' : ' (monthly only)'}`);
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
