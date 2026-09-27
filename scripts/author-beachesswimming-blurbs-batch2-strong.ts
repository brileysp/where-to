import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'beachesSwimming';

const MED_WINTER = "Water's down in the upper 50s°F — swimmable for the hardy, not the real season.";
const MED_SHOULDER = "Water's warming into the low-to-mid 70s°F — a real, if not peak, swim month.";
const MED_PEAK = "Water's at its warmest, high 70s to 80°F — the real swim season.";
const SH_WINTER = "Southern Hemisphere winter — genuinely cold, not a realistic swim month.";
const RAINY_ROUGH = "Rainy season — rougher, less clear water, not colder.";

const OVERVIEWS: Record<string, string> = {
  algarve: "The Algarve is Atlantic, not Mediterranean — water peaks around 68-73°F in summer (Jun-Oct) and drops to the high 50s°F in winter, genuinely cooler than the Mediterranean resorts it's often mentioned alongside.",
  amalfi: "The Amalfi Coast's water is a cold high-50s°F in winter and doesn't reach real swimming comfort until early summer — July, August, and early September, near 79°F, are the real season.",
  bali: "Bali's wet season (Nov-Mar) brings rougher, less clear water, not cold — the dry season (Apr-Oct) is calmer and clearer, though the water stays warm (82-86°F) year-round either way.",
  barcelona: "Barcelona's Mediterranean water is a cold high-50s°F in winter and doesn't reach real swimming comfort until early summer — July, August, and September, near 79°F, are the real season.",
  'big-island': "The Big Island's water stays warm year-round (75-81°F), but its coastline is rockier and its calm, sandy swim beaches fewer than Maui's — winter's bigger surf on exposed coasts is the real seasonal factor, not temperature.",
  borneo: "Malaysian Borneo's east coast (Sabah) gets the real seasonal disruption — the northeast monsoon (Nov-Feb, peak Dec-Jan) brings rough seas and real storm risk; the rest of the year is calm and warm.",
  canaries: "The Canaries sit in the subtropical Atlantic, not the tropics — water stays a mild 66-75°F essentially year-round, cooler than a true tropical destination but with almost no real seasonal swing.",
  'cape-cod-islands': "Cape Cod's Atlantic water is genuinely cold outside summer — comfortable swimming (>65°F) is specifically Jul-Sep; spring and fall both run well into the 40s-50s°F.",
  'cape-town': "Cape Town has two real, distinct coasts: the Atlantic Seaboard (Camps Bay, Clifton) stays a cold 54-61°F year-round thanks to the Benguela Current, while False Bay (Muizenberg, Gordon's Bay) runs a genuinely warmer 64-72°F — the same city, a real ~10°F difference.",
  'chilean-lake-district': "The Lake District's glacial lakes are genuinely cold in the Southern Hemisphere winter (Jun-Aug) — real swimming is a summer-only (Dec-Feb) proposition here, not a year-round option.",
  'costa-rica': "Costa Rica's beaches (both coasts) stay warm year-round; the real disruption is September and October, the rainiest months on both the Pacific and Caribbean sides, bringing rougher seas rather than colder water.",
  dubai: "Dubai's Persian Gulf water swings from a comfortable 72-75°F in winter to a genuinely too-hot 90-91°F by August — the real issue in summer is heat, not cold, and most people find Oct-Apr the more pleasant swim season.",
  ghana: "Ghana's Atlantic coast carries a real, well-documented rip current hazard — swim only at a lifeguarded beach; the rainy season (roughly Apr-Jul, with a smaller second peak Sep-Oct) brings rougher water on top of that.",
  havana: "Havana's water is warm year-round (79-84°F); hurricane season (Jun-Nov, peak Aug-Oct) brings real, sometimes severe, storm risk.",
  jamaica: "Jamaica's water stays warm year-round; hurricane season (Jun-Nov) brings real storm risk, and the rainy season's two peaks (May and Sep-Oct) add rougher water on top.",
  kerala: "Kerala's southwest monsoon (Jun-Sep) brings real, sustained rough water and rain — a genuine off-season, not just a quieter one; the rest of the year is calm and warm.",
  lisbon: "Lisbon's Atlantic beaches (Cascais, Costa da Caparica) rarely exceed the high 60s°F even at their summer peak — genuinely cold-Atlantic swimming, cooler than the Algarve further south.",
  'los-cabos': "Los Cabos' water is actually warmest during hurricane season (Jun-Nov, peak Aug-Oct, water in the low 80s°F) — but that's also when real storm risk peaks; the cooler Dec-May stretch (low-to-mid 70s°F) is calmer and safer, not just less warm.",
  madagascar: "Madagascar's cyclone season (Nov-Apr, peak Jan-Mar) brings real storm risk to the east coast in particular; the rest of the year is calm and warm.",
  'marlborough-abel-tasman': "This is Southern Hemisphere swimming — real summer (Dec-Feb) is warm and inviting, while winter (Jun-Jul) is genuinely cold, not just quieter.",
  morocco: "Beach swimming is a secondary feature here — Marrakech is inland, and the Atlantic coast (Essaouira-style) it borders runs cool and often windy rather than classic warm-Mediterranean, even in summer.",
  nicaragua: "Nicaragua's rainy season (May-Oct) brings real, sustained rough water on both coasts, not colder temperatures; the dry season (Nov-Apr) is calm and warm.",
  'nice-riviera': "The French Riviera's Mediterranean water is a cold high-50s°F in winter and doesn't reach real swimming comfort until early summer — July, August, and early September, near 79°F, are the real season.",
  'north-island': "This is Southern Hemisphere swimming — real summer (Dec-Feb) is warm, while winter (Jun-Aug) is genuinely cold, not just quieter.",
  palau: "Palau's wetter stretch (roughly Jun-Sep) brings rougher, less clear water, not colder — the rest of the year is calmer; Palau sits south of the main typhoon belt, so storm risk here is genuinely lower than the Philippines or Okinawa.",
  panama: "Panama has an unusually long rainy season (May-Nov, both coasts) that brings real, sustained rougher water for over half the year — the Dec-Apr dry season is the real, calm swim stretch.",
  'papua-new-guinea': "PNG's wet season (Dec-Mar) brings real rough water and storms on top of a coastline with fewer developed swim beaches than the rest of this tier — the drier months (Jun-Sep) are calmer and clearer.",
  puglia: "Puglia's water is a cold high-50s°F in winter and doesn't reach real swimming comfort until early summer — July, August, and early September, near 79°F, are the real season.",
  sicily: "Sicily's water is a cold high-50s°F in winter and doesn't reach real swimming comfort until early summer — July, August, and early September, near 79°F, are the real season.",
  srilanka: "Sri Lanka's west and south coasts (the most-visited beaches) take the real hit from the southwest monsoon (May-Sep, worst Jun-Aug) — genuinely rough and often dangerous water; the island's east coast runs the opposite calendar, calmest exactly when the west coast is worst.",
  'texas-hill-country': "This isn't ocean swimming — the Hill Country's draw is spring-fed rivers (the Guadalupe, Frio, Comal), which hold a cool, steady 68-72°F nearly year-round because the water comes straight from underground aquifers, not the sky.",
  vietnam: "Vietnam's central coast takes the real hit from its own typhoon season, peaking Sep-Oct — genuinely rough, sometimes dangerous water, not just rain; the rest of the year is calm.",
};

const MONTHLY: Record<string, string[]> = {
  algarve: [
    'Cold end of the range, around 60°F.', 'Same cold conditions.', 'Warming slowly, still well below comfortable.',
    'Warming further, not yet the real season.', 'Approaching the real season.',
    'Real swim season begins — above 68°F.', 'Peak warmth, around 73°F.', 'Same peak warmth.',
    'Same peak warmth continues.', 'Still within the real season, cooling slightly.',
    'Cooling back below the comfortable range.', 'Cold end of the range again.',
  ],
  amalfi: [MED_WINTER, MED_WINTER, 'Still cold — not yet a real swim month.', MED_SHOULDER, MED_SHOULDER, MED_PEAK, MED_PEAK, MED_PEAK, 'Still warm as the peak eases.', 'Cooling, but swimmable into a mild October.', MED_SHOULDER, MED_WINTER],
  bali: [
    'Wet season — rougher, less clear water.', 'Same wet-season conditions.', 'Wet season\'s tail end.',
    'Dry season begins — calmer, clearer water.', 'Same calm dry-season conditions.', 'Same calm dry-season conditions.',
    'Same calm dry-season conditions.', 'Same calm dry-season conditions.', 'Same calm dry-season conditions.',
    'Same calm dry-season conditions.', 'Wet season returns.', 'Same wet-season conditions.',
  ],
  barcelona: [MED_WINTER, 'Still cold, water just starting to turn.', MED_SHOULDER, MED_SHOULDER, MED_PEAK, MED_PEAK, 'Still warm as the peak eases slightly.', MED_PEAK, MED_PEAK, 'Cooling, but still swimmable into a mild October.', MED_WINTER, MED_WINTER],
  'big-island': [
    'Bigger surf on exposed coasts; sheltered beaches stay calm at 75-77°F.', 'Same winter-surf conditions.',
    'Still real winter swell; water warming toward 77°F.', 'Swell easing; a comfortable, transitional month.',
    'Consistently calm across most coasts.', 'Warm and calm — real summer conditions.',
    'Water near its warmest, 80-81°F.', 'Same warm, calm summer conditions.', 'Same warm, calm summer conditions.',
    'Still warm and calm as the season turns.', 'Water cooling slightly; surf picking back up on exposed coasts.',
    'Winter swell returns to exposed coasts; sheltered beaches stay calm.',
  ],
  borneo: [
    'Northeast monsoon\'s peak — real rough-water and storm risk on the east coast.', 'Same monsoon-peak conditions.',
    'Monsoon easing; conditions calming.', 'Calm season begins.', 'Same calm conditions.', 'Same calm conditions.',
    'Same calm conditions.', 'Same calm conditions.', 'Same calm conditions.', 'Same calm conditions.',
    'Monsoon season begins again, building toward its peak.', 'Monsoon\'s peak — real rough water returns.',
  ],
  canaries: Array(12).fill('Same mild 66-75°F range — almost no real seasonal swing here, subtropical rather than tropical.'),
  'cape-cod-islands': [
    'Water in the high 30s°F — genuinely too cold for real swimming.', 'Same frigid winter water.',
    'Warming slowly, still cold (40s°F).', 'Same cold spring water.', 'Still well below comfortable.',
    'Warming fast, approaching the real season.', 'Real swim season — above 65°F.', 'Peak warmth, around 68°F.',
    'Still within the real season.', 'Cooling back below comfortable.', 'Same cooling conditions.',
    'Back to genuinely cold water.',
  ],
  'cape-town': [
    'Southern Hemisphere summer — False Bay\'s warmer water is the better bet for comfortable swimming.',
    'Same warm-summer conditions.', 'Still warm as summer eases.', 'Cooling into autumn on both coasts.',
    'Same cooling conditions.', 'Winter — genuinely cold on the Atlantic side; False Bay stays comparatively milder.',
    'Same cold winter conditions.', 'Same cold winter conditions.', 'Warming back up as spring begins.',
    'Same warming spring conditions.', 'Same warming spring conditions.', 'Summer returns — warm again, especially False Bay.',
  ],
  'chilean-lake-district': [
    'Southern Hemisphere summer — the real swim season.', 'Same warm summer conditions.',
    'Still summer-warm, cooling as autumn approaches.', 'Autumn — cooling, still swimmable for the hardy.',
    'Cold enough now that this is a real stretch, not just quieter.', SH_WINTER, SH_WINTER, SH_WINTER,
    'Spring begins — still cold, warming slowly.', 'Same cool spring conditions.', 'Warming further.',
    'Summer returns — warm again.',
  ],
  'costa-rica': [
    'Dry season — calm on both coasts.', 'Same calm, dry conditions.', 'Same calm, dry conditions.',
    'Dry season\'s last month, still calm.', 'Rainier, but still warm; seas starting to roughen.',
    'Same rainier conditions.', 'Same rainier conditions.', 'Same rainier conditions.',
    'The rainiest month on both coasts — genuinely rougher water.', 'Same rainy-season peak conditions.',
    'Conditions calming as the dry season approaches.', 'Dry season returns — calm again.',
  ],
  dubai: [
    'Comfortable, around 72-73°F.', 'Coolest of the year, around 72°F.', 'Warming toward the mid-70s°F.',
    'Warm and pleasant, mid-to-high 70s°F.', 'One of the most comfortable months, around 80°F.',
    'Warming fast toward the high 80s°F.', 'Genuinely too hot for a long swim, around 90°F.',
    'Peak heat, around 91°F — bathwater-warm, not refreshing.', 'Still very warm, easing slightly.',
    'Cooling back toward the high 70s°F.', 'Comfortable again, mid-70s°F.', 'Comfortable, around 73°F.',
  ],
  ghana: [
    'Calmer stretch — rip currents are still a real, year-round hazard regardless of season.',
    'Same calmer conditions; same rip-current caution applies.', 'Same calmer conditions.',
    'Rainy season begins — rougher water on top of the ever-present rip-current risk.',
    RAINY_ROUGH, 'The rainy season\'s heaviest stretch.', 'Same rough, rainy conditions.',
    'Conditions calming as the main rains ease.', 'A smaller second rainy peak begins.', 'Same rainier conditions.',
    'Calmer conditions return; rip currents remain a year-round hazard.', 'Same calmer conditions.',
  ],
  havana: [
    'Dry season — calm, clear water.', 'Same calm, dry conditions.', 'Same calm, dry conditions.',
    'Dry season\'s last month, still calm.', 'Hurricane season begins; still mostly calm.',
    'Risk is rising, though not yet at its peak.', 'Risk continues building.',
    'Peak hurricane season — real, sometimes severe, storm risk.', 'Peak season continues.',
    'Still elevated risk as peak season eases.', 'Dry season returns — calm and clear.', 'Same calm, dry conditions.',
  ],
  jamaica: [
    'Dry season — calm and warm.', 'Same calm, dry conditions.', 'Same calm, dry conditions.',
    'Dry season\'s last month, still calm.', 'A real rainy-season peak — rougher water.',
    'Hurricane season begins; conditions calming from May\'s peak.', 'Real hurricane-season risk, easing rain.',
    'Same hurricane-season risk.', 'A second rainy-season peak begins.', 'Same rainier conditions.',
    'Hurricane season\'s tail end, still real risk.', 'Dry season returns — calm and warm.',
  ],
  kerala: [
    'Calm, warm conditions.', 'Same calm conditions.', 'Same calm conditions.', 'Same calm conditions.',
    'Same calm conditions, the season\'s last full month.', 'The southwest monsoon arrives — genuinely rough, sustained rain and surf.',
    'Same rough monsoon conditions.', 'Same rough monsoon conditions.', 'Monsoon\'s tail end, still rough.',
    'Conditions calming as the monsoon retreats.', 'Calm conditions return.', 'Same calm conditions.',
  ],
  lisbon: [
    'Cold, around 60°F.', 'Same cold conditions.', 'Warming slowly, still cold.', 'Same cool spring water.',
    'Approaching the season\'s better months.', 'Real swim season — into the mid-60s°F.',
    'Peak warmth for this coast, around 66-68°F.', 'Same peak warmth.', 'Still within the season.',
    'Cooling back down.', 'Cold again.', 'Cold, around 60°F.',
  ],
  'los-cabos': [
    'Calmer, cooler stretch — low-to-mid 70s°F, safer than the warmer months.', 'Same calm conditions.',
    'Same calm conditions.', 'Same calm conditions.', 'Same calm conditions, warming slightly.',
    'Hurricane season begins; water is warming into the 80s°F, but real storm risk starts building.',
    'Same warm water, same building risk.', 'Peak warmth and peak hurricane risk together.',
    'Same peak warmth, same peak risk.', 'Still warm, still real risk.', 'Hurricane season easing; water still warm.',
    'Calm season returns — cooler and safer.',
  ],
  madagascar: [
    'Cyclone season\'s peak — real storm risk, especially on the east coast.', 'Same cyclone-season risk.',
    'Cyclone season\'s tail end.', 'Risk easing as the season winds down.', 'Calm season begins.',
    'Same calm conditions.', 'Same calm conditions.', 'Same calm conditions.', 'Same calm conditions.',
    'Same calm conditions.', 'Cyclone season returns, building slowly at first.', 'Risk continues building toward peak.',
  ],
  'marlborough-abel-tasman': [
    'Southern Hemisphere summer — the real swim season.', 'Same warm summer conditions.',
    'Still summer-warm as autumn approaches.', 'Cooling into autumn.', 'Same cooling conditions.',
    SH_WINTER, SH_WINTER, 'Still cool, warming slightly.', 'Same cool spring conditions.',
    'Same cool spring conditions.', 'Same cool spring conditions.', 'Summer returns — warm again.',
  ],
  morocco: [
    'Cool, often windy — a secondary feature of an inland-focused destination.', 'Same cool, breezy conditions.',
    'Warming slightly.', 'Same mild conditions.', 'Same mild conditions.',
    'About as warm as this coast gets, still cool by beach-holiday standards.', 'Same mild summer conditions.',
    'Same mild summer conditions.', 'Cooling slightly as summer ends.', 'Same mild conditions.',
    'Same mild conditions.', 'Cool again.',
  ],
  nicaragua: [
    'Dry season — calm on both coasts.', 'Same calm, dry conditions.', 'Same calm, dry conditions.',
    'Dry season\'s last month, still calm.', 'Rainy season begins — real, sustained rough water.',
    'Same rough, rainy conditions.', 'Same rough, rainy conditions.', 'Same rough, rainy conditions.',
    'Same rough, rainy conditions.', 'Same rough, rainy conditions.', 'Conditions calming as the dry season returns.',
    'Dry season returns — calm again.',
  ],
  'nice-riviera': [MED_WINTER, 'Still cold, water just starting to turn.', MED_SHOULDER, MED_SHOULDER, MED_SHOULDER, MED_PEAK, MED_PEAK, MED_PEAK, MED_PEAK, 'Cooling, but still swimmable into a mild October.', MED_WINTER, MED_WINTER],
  'north-island': [
    'Southern Hemisphere summer — the real swim season.', 'Same warm summer conditions.',
    'Still summer-warm as autumn approaches.', 'Cooling into autumn.', 'Same cooling conditions.',
    SH_WINTER, SH_WINTER, SH_WINTER, 'Spring begins — still cool.', 'Same cool spring conditions.',
    'Same cool spring conditions.', 'Summer returns — warm again.',
  ],
  palau: [
    'Calmer, clearer conditions.', 'Same calm conditions.', 'Same calm conditions.', 'Same calm conditions.',
    'Wetter stretch begins — rougher water, not colder.', 'Same wetter conditions.', 'Same wetter conditions.',
    'Same wetter conditions.', 'Same wetter conditions.', 'Conditions calming as the wetter stretch eases.',
    'Calm conditions return.', 'Same calm conditions.',
  ],
  panama: [
    'Dry season — the real calm swim stretch on both coasts.', 'Same calm, dry conditions.',
    'Same calm, dry conditions.', 'Dry season\'s last month, still calm.',
    'The long rainy season begins — real, sustained rougher water for months.', 'Same rainy-season conditions.',
    'Same rainy-season conditions.', 'Same rainy-season conditions.', 'Same rainy-season conditions.',
    'Same rainy-season conditions.', 'Rainy season\'s tail end, still rough.', 'Dry season returns — calm again.',
  ],
  'papua-new-guinea': [
    'Wet season\'s peak — real rough water and storms.', 'Same wet-season conditions.',
    'Wet season\'s tail end.', 'Drier season begins — calmer, clearer.', 'Same calmer conditions, warming.',
    'Same calm, dry conditions.', 'Same calm, dry conditions.', 'Same calm, dry conditions.',
    'Same calm, dry conditions.', 'Conditions roughening as the wet season approaches.',
    'Same roughening conditions.', 'Wet season begins — rough water and storms return.',
  ],
  puglia: [MED_WINTER, 'Still cold, water just starting to turn.', MED_SHOULDER, MED_SHOULDER, MED_PEAK, MED_PEAK, 'Still warm as the peak eases.', MED_PEAK, MED_PEAK, 'Cooling, but still swimmable into a mild October.', MED_WINTER, MED_WINTER],
  sicily: [MED_WINTER, 'Still cold, water just starting to turn.', MED_SHOULDER, MED_SHOULDER, MED_PEAK, MED_PEAK, 'Still warm as the peak eases.', MED_PEAK, MED_PEAK, 'Cooling, but still swimmable into a mild October.', MED_WINTER, MED_WINTER],
  srilanka: [
    'Calm on the west and south coasts — the real season there.', 'Same calm conditions.', 'Same calm conditions.',
    'Conditions starting to roughen as the monsoon approaches.', 'The southwest monsoon begins — genuinely rough, often dangerous water on the west/south coasts.',
    'Monsoon\'s worst stretch on the west/south coasts — the east coast runs the opposite, calmer, calendar.',
    'Same monsoon-peak conditions.', 'Monsoon easing.', 'Conditions calming on the west/south coasts.',
    'Calm season returns on the west/south coasts.', 'Same calm conditions.', 'Same calm conditions.',
  ],
  'texas-hill-country': Array(12).fill('The same steady 68-72°F, spring-fed and swimmable — this doesn\'t really have a season the way ocean or lake swimming does.'),
  vietnam: [
    'Calm conditions on the central coast.', 'Same calm conditions.', 'Same calm conditions.',
    'Same calm conditions.', 'Same calm conditions, the season\'s last full month.',
    'Same calm conditions continue.', 'Same calm conditions.', 'Same calm conditions.',
    'Typhoon season\'s peak — genuinely rough, sometimes dangerous water on the central coast.',
    'Same typhoon-peak conditions.', 'Conditions calming as typhoon season eases.', 'Calm conditions return.',
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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12 (got ${MONTHLY[id].length})`); process.exit(1); }
    const patch = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
    };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id, action: 'update', beforeValue: row, afterValue: after });
      });
    }
    console.log(`  ${id}`);
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
