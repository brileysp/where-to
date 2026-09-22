import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'beachesSwimming';

// Shared bucket text — reused verbatim wherever the real phenomenon and
// timing genuinely match, per the playbook's skeleton convention.
const HURRICANE_PEAK = "Hurricane season's most active stretch — real storm risk, not just rougher water.";
const HURRICANE_SEASON_MILD = "Within hurricane season, but well before its peak — still mostly calm.";
const HURRICANE_SEASON_FADING = "Hurricane season is winding down, though a late storm is still possible.";
const MED_WINTER = "Water's down in the upper 50s°F — swimmable for the hardy, not the real season.";
const MED_SHOULDER = "Water's warming into the low-to-mid 70s°F — a real, if not peak, swim month.";
const MED_PEAK = "Water's at its warmest, high 70s to 80°F — the real swim season.";

const OVERVIEWS: Record<string, string> = {
  aruba: "Aruba sits south of the main Caribbean hurricane belt, so the water stays a steady 80-84°F essentially all year — no real season to plan around.",
  bahamas: "The Bahamas' water is warm year-round (77-84°F), but hurricane season (Jun-Nov, peak Aug-Oct) brings real storm risk on top of the Atlantic's rougher, cooler late-summer water.",
  barbados: "Barbados sits at the hurricane belt's southeastern edge — real risk still rises through peak season (Aug-Oct), just somewhat less than islands further north and west.",
  belize: "Belize's barrier reef — the second-largest on Earth — keeps inshore water unusually calm even through hurricane season; real storm risk still peaks Aug-Oct, just with less of the open-ocean chop other Caribbean islands get.",
  borabora: "Bora Bora's lagoon stays warm (79-84°F) year-round; French Polynesia's cyclone season (Nov-Apr, peak Jan-Mar) brings real if infrequent storm risk, rarely a direct hit.",
  'colombian-caribbean': "Cartagena's coast sits south of the main hurricane track, so the real seasonal driver is rain, not storms — a wetter, rougher stretch runs roughly May through November.",
  croatia: "The Adriatic swings from a genuinely cold 57-60°F in winter to 78-80°F by late summer — this is real Mediterranean seasonality, not a flat tropical destination.",
  egypt: "The Red Sea stays swimmable nearly year-round (70-82°F) — winter (Dec-Feb) is noticeably cooler, not cold, and summer (Jun-Aug) is warm enough that many prefer the shoulder months for comfort.",
  fiji: "Fiji's water stays warm year-round (79-85°F), but cyclone season (Nov-Apr, peak Jan-Mar) brings real risk — rough surf, strong currents, and storms that can close beaches outright.",
  galapagos: "The warm season (Dec-May, 77-80°F) has genuinely calmer, clearer water; the cooler Garua season (Jun-Nov) brings the Humboldt Current's rougher, colder (66°F) water — the opposite of what the calendar might suggest for a Southern Hemisphere destination.",
  gbr: "Tropical Queensland's real hazard is box jellyfish and Irukandji, present roughly Nov-May — many popular beaches run stinger nets and lifeguards through the season, and a full-body stinger suit is standard, not optional.",
  komodo: "Komodo's dry season (Apr-Dec) brings calmer, clearer water; the wet season (Jan-Mar) is real but modest here compared to the rest of Indonesia — rougher seas and lower visibility, not a shutdown.",
  maldives: "The Maldives' lagoons are naturally sheltered coral atolls — calm water in the low 80s°F essentially year-round. The dry season (Dec-Apr) adds flat, glassy conditions on top of that; the wetter months bring brief afternoon showers but rarely disrupt swimming itself.",
  mallorca: "Mallorca's water is a genuinely cold 57-63°F in winter and doesn't reach real swimming comfort until late spring — July, August, and early September, at 78-80°F, are the real season.",
  maui: "Maui's water stays comfortable year-round (74-80°F, never below 70°F) — winter's real change is bigger surf and stronger currents on the north shore, not colder water; the south and west coasts stay calm and sheltered.",
  mauritius: "Mauritius stays warm (77-84°F) year-round; cyclone season (Nov-Apr, peak Jan-Mar) brings real if occasional risk, and the calmer trade-wind months (May-Oct, especially the west coast) are the more reliably placid stretch.",
  okinawa: "Okinawa has real rain (the early-summer 'tsuyu' plum rains, roughly May-Jun) and a real typhoon peak (Aug-Sep) worth planning around — outside those windows the water is warm and calm.",
  palawan: "Palawan's dry season (Nov-May) brings calm, clear water; the wet season peaks Jul-Sep with the Philippines' own typhoon season, bringing real rough-water and storm risk, not just rain.",
  'puerto-rico': "Puerto Rico's water stays warm (79-84°F) essentially year-round; hurricane season (Jun-Nov) brings real if inconsistent storm risk rather than a predictable seasonal dip.",
  'punta-cana': "Punta Cana's water is warm year-round (77-84°F); the real seasonal driver is a wetter, rougher stretch roughly May through November, with hurricane season's own real storm risk layered on top, Aug-Oct.",
  rajaampat: "Raja Ampat's water stays warm (82-86°F) all year; the main change is visibility and chop, not temperature — the SE monsoon (Jun-Aug) brings choppier seas and reduced visibility, while Oct-Apr is generally calmer.",
  rio: "Rio's beaches face a real, counterintuitive seasonal swing: water is warmest in Brazilian summer (Dec-Mar, upper 70s to low 80s°F) and genuinely cools in winter (Jun-Aug, low-to-mid 70s°F) — still swimmable in winter, just noticeably less warm.",
  rivieramaya: "The Riviera Maya's water is warm year-round (79-84°F); hurricane season (Jun-Nov, peak Aug-Oct) brings real storm risk on top of rougher seas.",
  santorini: "Santorini's water is a genuinely cold 58-61°F in winter and doesn't reach real swimming comfort until early summer — July, August, and early September, near 79°F, are the real season.",
  sardinia: "Sardinia's water is a cold 58-61°F in winter, warming to a real 78-80°F peak by July through early September — classic Mediterranean seasonality, not year-round warmth.",
  seychelles: "Seychelles stays warm (79-84°F) year-round; the Dec-Mar northwest monsoon brings more rain and a touch more chop, while the Apr-May and Oct-Nov transitions between monsoons are the calmest, clearest stretches.",
  sydney: "Sydney's water swings from a summer 79°F (Jan-Feb) down to a genuinely cool 64°F by mid-winter (Jun-Aug) — real seasonality, not a tropical destination, though ocean pools and sheltered coves stay popular with regulars year-round.",
  tanzania: "Zanzibar's water stays warm (79-84°F) year-round; the real disruption is the 'long rains' (roughly Mar-May), which bring rougher seas and lower visibility, not colder water.",
  thailand: "Phuket and the Andaman coast run on the opposite monsoon calendar from the Gulf side — real rough water and lower visibility hit roughly May through October, peaking Jun-Oct, while Nov-Apr is calm and clear.",
  'turks-caicos': "Turks & Caicos' water is warm year-round (77-84°F); hurricane season (Jun-Nov, peak Aug-Oct) brings real, sometimes severe, storm risk on top of rougher seas.",
};

const MONTHLY: Record<string, string[]> = {
  aruba: Array(12).fill('Same steady 80-84°F — no real season here, hurricane belt or otherwise.'),
  bahamas: [
    'Warm (80-82°F) and calm — dry season, low storm risk.', 'Same calm, dry conditions continue.',
    'Still within the calm dry season.', 'Warm and calm, the dry season\'s last full month.',
    HURRICANE_SEASON_MILD, 'Hurricane season is underway; still mostly calm, but real risk is rising.',
    'Real risk continues to build toward peak season.', HURRICANE_PEAK, HURRICANE_PEAK,
    HURRICANE_PEAK, HURRICANE_SEASON_FADING, 'Dry season returns — warm and calm again.',
  ],
  barbados: [
    'Warm and calm — dry season, low storm risk.', 'Same calm, dry conditions continue.',
    'Still within the calm dry season.', 'Warm and calm, the dry season\'s last full month.',
    HURRICANE_SEASON_MILD, 'Hurricane season is underway; risk is still real but building.',
    'Real risk continues to build toward peak season.', HURRICANE_PEAK, HURRICANE_PEAK,
    HURRICANE_PEAK, HURRICANE_SEASON_FADING, 'Dry season returns — warm and calm again.',
  ],
  belize: [
    'Warm and calm — dry season conditions.', 'Same calm, dry conditions continue.',
    'Still within the calm dry season.', 'Warm and calm, dry season\'s last full month.',
    'Hurricane season begins; the reef keeps inshore water calmer than the open Caribbean.',
    'Real storm risk is rising, though the reef takes the edge off open-water chop.',
    'Risk continues building toward peak season.', 'Peak hurricane season — real storm risk, reef or no reef.',
    'Peak hurricane season continues.', 'Still within peak season, though easing slightly.',
    'Hurricane season is winding down.', 'Dry season returns — calm again.',
  ],
  borabora: [
    'A rare direct cyclone hit is most possible now, though the lagoon stays warm.', 'Same real, if low, cyclone-season risk.',
    'Cyclone season\'s peak — still a low-probability risk, but the real one of the year.',
    'Cyclone season is ending; conditions calm quickly.', 'Calm season returns — warm, settled lagoon water.',
    'Same calm, dry-season conditions.', 'Same calm, dry-season conditions.', 'Same calm, dry-season conditions.',
    'Same calm, dry-season conditions.', 'Same calm, dry-season conditions.', 'Same calm, dry-season conditions.',
    'Cyclone season begins again, though risk builds slowly at first.',
  ],
  'colombian-caribbean': [
    'Dry season — calm, clear water.', 'Same calm, dry conditions continue.', 'Still within the dry season.',
    'The wetter season begins — rougher seas, not cold water.', 'Same wetter-season conditions.',
    'Same wetter-season conditions.', 'Same wetter-season conditions.', 'Same wetter-season conditions.',
    'Same wetter-season conditions.', 'Same wetter-season conditions.', 'Same wetter-season conditions.',
    'Dry season returns — calm and clear again.',
  ],
  croatia: [
    MED_WINTER, MED_WINTER, 'Still cold, water just starting to turn — not yet a real swim month.',
    MED_SHOULDER, MED_SHOULDER, MED_PEAK, MED_PEAK, MED_PEAK, MED_PEAK,
    'Real swimming continues into a warm (69°F) October — the Adriatic\'s thermal lag.', MED_SHOULDER, MED_WINTER,
  ],
  egypt: [
    'Cooler end of the range, around 70°F — still swimmable, not the warmest.', 'Same cooler conditions.',
    'Warming toward the mid-70s°F.', 'Approaching a genuinely warm 79°F.',
    'Warm, near 79°F — one of the best-visibility months of the year.', 'Warm, into the low 80s°F.',
    'Peak warmth, around 82°F.', 'Peak warmth continues, around 82°F.',
    'Still warm, high visibility as conditions calm into autumn.', 'Warm, near 79°F, with some of the year\'s best visibility.',
    'Cooling toward the mid-70s°F.', 'Cooler end of the range again, around 72°F.',
  ],
  fiji: [
    'Water near 85°F at its warmest, but this is cyclone season\'s peak — rough surf and real storm risk make it a genuine off-season, not just a quieter one.',
    'Same cyclone-season peak conditions.', 'Cyclone season\'s tail end — still real risk.',
    'Cyclone season is easing; water is cooling toward its most comfortable range.',
    'Dry season begins — flat, clear, and free of storm risk.', 'Same calm dry-season conditions.',
    'Water around 79°F at its coolest, but dry-season seas stay flat and clear.', 'Same calm dry-season conditions.',
    'Same calm dry-season conditions.', 'Same calm dry-season conditions.',
    'Cyclone season begins again, though early-month conditions are usually still calm.',
    'Risk is rising as cyclone season builds toward its January peak.',
  ],
  galapagos: [
    'Warm season — clear, calm water near 77°F.', 'Same warm, calm conditions.', 'Same warm, calm conditions.',
    'Still within the warm season, water near 77°F.', 'The warm season\'s last month — still calm, cooling slightly.',
    'Garua season begins — the Humboldt Current brings rougher, colder (66°F) water.',
    'Same cold, rough Garua-season conditions.', 'Same cold, rough Garua-season conditions.',
    'Same cold, rough Garua-season conditions.', 'Same cold, rough Garua-season conditions.',
    'Garua season is easing as the warm season approaches.', 'Warm season returns — clear, calm, and near 77°F again.',
  ],
  gbr: [
    'Stinger season — box jellyfish and Irukandji are present; netted beaches and a stinger suit are standard.',
    'Same stinger-season precautions apply.', 'Same stinger-season precautions apply.',
    'Still within stinger season, though easing toward its end.', 'Stinger season\'s tail end.',
    'Stinger season has ended — swimming without a suit is realistic again.', 'Clear of stingers, calm and warm.',
    'Clear of stingers, calm and warm.', 'Clear of stingers, calm and warm.', 'Clear of stingers, calm and warm.',
    'Stinger season begins again, though risk builds gradually at first.', 'Within stinger season — precautions apply.',
  ],
  komodo: [
    'Wet season — real, if modest here; rougher and less clear than the dry months.', 'Same wet-season conditions.',
    'Wet season\'s tail end.', 'Dry season begins — calmer, clearer water.', 'Same calm dry-season conditions.',
    'Same calm dry-season conditions.', 'Same calm dry-season conditions.', 'Same calm dry-season conditions.',
    'Same calm dry-season conditions.', 'Same calm dry-season conditions.', 'Same calm dry-season conditions.',
    'Same calm dry-season conditions.',
  ],
  maldives: [
    'Water around 84°F, flat and glassy under the dry season\'s clearest skies.', 'Same dry-season conditions.',
    'Same dry-season conditions.', 'Dry season\'s last month — still flat and clear.',
    'Wetter season begins — water stays warm, but expect a passing shower, not rough seas.',
    'Same warm, occasionally showery conditions.', 'Water around 82°F; wetter season continues.',
    'Same warm, occasionally showery conditions.', 'Same warm, occasionally showery conditions.',
    'Same warm, occasionally showery conditions.', 'Same warm, occasionally showery conditions.',
    'Dry season returns — flat and glassy again.',
  ],
  mallorca: [
    MED_WINTER, MED_WINTER, 'Still cold — not yet a real swim month.', MED_SHOULDER, MED_SHOULDER,
    MED_PEAK, MED_PEAK, MED_PEAK, MED_PEAK, 'Cooling, but still swimmable into a mild October.',
    MED_SHOULDER, MED_WINTER,
  ],
  maui: [
    'Water in the mid-70s°F; north-shore surf is up, so stick to the calmer south and west coasts.',
    'Similar — big north-shore swells, but the sheltered coasts stay calm.',
    'Water warming toward 76°F; still real winter swell on the north shore.',
    'Winter swell is easing; water and conditions both improving.',
    'A comfortable, transitional month — warming water, calming surf.',
    'Water into the high 70s°F; consistently calm across most coasts.',
    'Water near its warmest, high 70s to 80°F.', 'Same warm, calm summer conditions.',
    'Same warm, calm summer conditions.', 'Still warm and calm as the season turns.',
    'Water cooling slightly; north-shore surf is picking back up.',
    'Winter swell returns to the north shore; south and west stay calm.',
  ],
  mauritius: [
    'Cyclone season\'s peak — real, if occasional, storm risk.', 'Same cyclone-season risk.',
    'Cyclone season\'s tail end, still a real if lower risk.', 'Trade winds return — calmer, more settled seas.',
    'Trade-wind season — one of the more reliably placid stretches, especially on the west coast.',
    'Same calm trade-wind conditions.', 'Same calm trade-wind conditions.', 'Same calm trade-wind conditions.',
    'Same calm trade-wind conditions.', 'Same calm trade-wind conditions.',
    'Trade winds easing as cyclone season approaches.', 'Cyclone season begins; risk is still building.',
  ],
  okinawa: [
    'Warm and calm.', 'Warm and calm.', 'Warm and calm.', 'Warming further, still calm.',
    'The "tsuyu" plum rains begin — real, sustained wet weather, not just showers.',
    'Tsuyu rains continue.', 'Rains have cleared — warm, clear water returns.',
    'Typhoon season\'s peak — real storm risk, not just rain.', 'Typhoon season continues at its peak.',
    'Typhoon risk is easing; conditions calming.', 'Clear and warm again.', 'Clear and warm again.',
  ],
  palawan: [
    'Dry season — calm, clear water.', 'Same calm, dry conditions.', 'Same calm, dry conditions.',
    'Same calm, dry conditions.', 'Dry season\'s last month, still calm.',
    'Wet season begins; conditions are roughening but not yet at their worst.',
    'The Philippines\' typhoon season peaks here — real storm and rough-water risk.',
    'Typhoon season\'s peak continues.', 'Typhoon season\'s peak continues.',
    'Conditions calming as the wet season eases.', 'Dry season returns.', 'Same calm, dry conditions.',
  ],
  'puerto-rico': Array(12).fill('Warm (79-84°F) essentially all year; hurricane season (Jun-Nov) brings real, if inconsistent, storm risk.'),
  'punta-cana': [
    'Dry season — calm, clear water.', 'Same calm, dry conditions.', 'Same calm, dry conditions.',
    'Dry season\'s last month, still calm.', 'The wetter season begins — rougher seas.',
    'Same wetter-season conditions, with hurricane season now underway.',
    'Hurricane risk is building toward its peak.', HURRICANE_PEAK, HURRICANE_PEAK,
    HURRICANE_PEAK, HURRICANE_SEASON_FADING, 'Dry season returns — calm and clear again.',
  ],
  rajaampat: [
    'Generally calm, clear conditions.', 'Same calm conditions.', 'Same calm conditions.',
    'Same calm conditions.', 'Same calm conditions.', 'The SE monsoon brings choppier seas and reduced visibility.',
    'Same choppier monsoon conditions.', 'Same choppier monsoon conditions.',
    'Conditions calming as the monsoon eases.', 'Calm conditions return.', 'Same calm conditions.', 'Same calm conditions.',
  ],
  rio: [
    'Brazilian summer — water near its warmest, upper 70s to low 80s°F.', 'Same warm summer conditions.',
    'Still summer-warm, cooling slightly as autumn approaches.', 'Autumn — water cooling into the high 70s°F.',
    'Same cooling autumn conditions.', 'Winter begins — genuinely cooler water, low-to-mid 70s°F.',
    'Same cooler winter conditions — still swimmable, just noticeably less warm.',
    'Same cooler winter conditions.', 'Spring — water warming back up.', 'Same warming spring conditions.',
    'Same warming spring conditions.', 'Summer returns — water back near its warmest.',
  ],
  rivieramaya: [
    'Dry season — calm, clear water.', 'Same calm, dry conditions.', 'Same calm, dry conditions.',
    'Dry season\'s last month, still calm.', HURRICANE_SEASON_MILD,
    'Hurricane season is underway; risk is still building.', 'Risk continues building toward peak season.',
    HURRICANE_PEAK, HURRICANE_PEAK, 'Peak season continues, easing slightly.',
    HURRICANE_SEASON_FADING, 'Dry season returns — calm and clear again.',
  ],
  santorini: [
    MED_WINTER, MED_WINTER, 'Still cold — not yet a real swim month.', MED_SHOULDER, MED_SHOULDER,
    MED_PEAK, MED_PEAK, MED_PEAK, MED_PEAK, 'Cooling, but still swimmable into a mild October.',
    MED_SHOULDER, MED_WINTER,
  ],
  sardinia: [
    MED_WINTER, MED_WINTER, 'Still cold — not yet a real swim month.', MED_SHOULDER, MED_SHOULDER,
    MED_PEAK, MED_PEAK, MED_PEAK, MED_PEAK, 'Cooling, but still swimmable into a mild October.',
    MED_SHOULDER, MED_WINTER,
  ],
  seychelles: [
    'Northwest monsoon — more rain and a touch more chop than the rest of the year.', 'Same monsoon conditions.',
    'The monsoon is easing; conditions calming.', 'One of the calmest, clearest transitional months.',
    'Same calm, clear transitional conditions.', 'Southeast trade winds begin — a bit windier, but generally settled.',
    'Same trade-wind conditions.', 'Same trade-wind conditions.', 'Same trade-wind conditions.',
    'Trade winds ease into another calm, clear transitional stretch.', 'Same calm, clear conditions.',
    'The northwest monsoon returns.',
  ],
  sydney: [
    'Water near its warmest, 79°F.', 'Same warm summer conditions.', 'Still warm as summer eases into autumn.',
    'Cooling into the low 70s°F.', 'Cooling further, upper 60s°F.', 'Genuinely cool, mid-60s°F — a real winter, not a tropical one.',
    'Same cool winter water; ocean pools and sheltered coves stay popular with regulars.',
    'Same cool winter conditions.', 'Warming back into the upper 60s°F.', 'Warming further, low 70s°F.',
    'Warming toward summer levels.', 'Back to a warm 79°F.',
  ],
  tanzania: [
    'Warm and calm.', 'Warm and calm.', 'The "long rains" begin — rougher seas and lower visibility, not colder water.',
    'Long rains continue.', 'Long rains ease toward the month\'s end.', 'Clear, calm conditions return.',
    'Same clear, calm conditions.', 'Same clear, calm conditions.', 'Same clear, calm conditions.',
    'Same clear, calm conditions.', 'Same clear, calm conditions.', 'Warm and calm.',
  ],
  thailand: [
    'Calm season on the Andaman coast — clear water, low swell.', 'Same calm conditions.', 'Same calm conditions.',
    'Same calm conditions, the season\'s last full month.', 'Monsoon season begins — rougher water, lower visibility.',
    'Monsoon conditions building toward their peak.', 'Same rough monsoon conditions.', 'Same rough monsoon conditions.',
    'Same rough monsoon conditions.', 'Monsoon season\'s peak — the roughest, least clear stretch of the year.',
    'Conditions calming as the monsoon eases.', 'Calm season returns.',
  ],
  'turks-caicos': [
    'Dry season — calm, clear water.', 'Same calm, dry conditions.', 'Same calm, dry conditions.',
    'Dry season\'s last month, still calm.', HURRICANE_SEASON_MILD,
    'Hurricane season is underway; risk is still building.', 'Risk continues building toward peak season.',
    HURRICANE_PEAK, HURRICANE_PEAK, HURRICANE_PEAK, HURRICANE_SEASON_FADING,
    'Dry season returns — calm and clear again.',
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
