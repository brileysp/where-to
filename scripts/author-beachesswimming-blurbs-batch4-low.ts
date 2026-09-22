import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'beachesSwimming';

const NA_SEASON = 'Outside the swim season — cold enough that this isn\'t a realistic month for it.';
const NOT_A_DRAW = 'Same as any other month — this isn\'t why anyone visits.';

const OVERVIEWS: Record<string, string> = {
  andalucia: "This destination's focus is inland (Seville, Granada, the Alhambra) — the real Costa del Sol coast exists but isn't part of the story here, so any swimming is a minor add-on, not a reason to visit.",
  'badlands-black-hills': "There's no real beach or lake culture in this destination — Pactola Reservoir in the Black Hills offers a modest, secondary swim option in summer, but it's not why anyone comes here.",
  'belfast-giants-causeway': "Northern Ireland's water is genuinely marginal even at its best — real sea-temperature data shows no month is favorable for swimming, with a late-summer lag peak (around 57°F in September) rather than a real warm season.",
  bhutan: "Bhutan is landlocked and mountainous, with cold rivers used for rafting, not swimming — this simply isn't a swim destination, monsoon season or not.",
  bordeaux: "Wine country, not a beach destination — the real Atlantic coast (Arcachon Bay) is nearby but cold and exposed, a minor secondary option at best.",
  cotswolds: "No coastline here — any swimming means a village lido or a stretch of the Thames or Windrush. A pleasant local pastime, not a real reason to visit.",
  'douro-valley-porto': "Porto's Atlantic beaches are real but genuinely cold — this is a wine and river-valley destination first, with swimming a minor, secondary option year-round rather than a real summer highlight.",
  everglades: "This is real alligator habitat — open-water swimming is a genuine hazard here, not a recreational option, and the park doesn't promote it.",
  'glacier-waterton': "These are cold mountain lakes with a short, real summer swim window (roughly May-Oct) — genuinely cold outside it, not just quieter.",
  'hudson-valley': "A handful of real swimming holes exist in the valley, but this is a wine-and-scenery destination first — swimming is a minor summer option, not the draw.",
  ireland: "Irish sea temperatures peak around 66°F in July and drop to 43°F in February — genuinely cold water year-round, with a real if modest summer window rather than a warm-water season.",
  'lake-district': "England's lakes warm faster than the sea but still peak Jun-Sep (into the 60s°F) and turn genuinely cold (45-52°F) the rest of the year — real wild swimming, not a warm-water destination.",
  nepal: "Nepal is landlocked and mountainous, with rivers used for rafting, not swimming — this simply isn't a swim destination.",
  'new-orleans': "This isn't a swim destination — the city's draw is food, music, and history, and nearby Lake Pontchartrain isn't a real swimming spot most visitors use.",
  olympic: "The Washington coast's Pacific water stays around 50°F even at its warmest — genuinely too cold for real swimming without a wetsuit, any season.",
  'quebec-city': "The St. Lawrence is a scenic backdrop here, not a swim destination — cold water year-round with only a brief, modest warmer stretch in summer.",
  redwood: "Northern California's Pacific water stays cold (rarely above 60°F) even in summer, thanks to constant upwelling — real swimming here means a wetsuit, not a warm-water option.",
  rioja: "Wine country, landlocked — any swimming here is an incidental river dip, not a real feature of this destination.",
  'scottish-highlands-skye': "Scottish water rarely exceeds 55-59°F even at its warmest (Jul-Aug) — genuinely cold, real swimming for the hardy rather than a warm-water season.",
  snowdonia: "Welsh coastal water peaks around 57-64°F in summer (Jun-Sep) and drops to a genuinely cold 45-52°F in winter — real but bracing swimming, not a warm-water destination.",
  'st-andrews-fife': "Scotland's North Sea coast here is genuinely cold year-round — any swimming is a brief, hardy summer option, not a real feature of the destination.",
  'zion-bryce': "Real swimming here means the Virgin River's Narrows hike (wading more than swimming) — genuinely cold, snowmelt-fed water, and closed outright during spring runoff and flash-flood risk.",
};

const MONTHLY: Record<string, string[]> = {
  andalucia: [NA_SEASON, NA_SEASON, NA_SEASON, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NA_SEASON, NA_SEASON],
  'badlands-black-hills': [NA_SEASON, NA_SEASON, 'Reservoir still too cold.', 'Same cold conditions.', 'Same cold conditions.', 'A modest real window begins.', 'Same modest window.', 'Same modest window.', 'Same modest window.', 'Cooling.', 'Too cold again.', NA_SEASON],
  'belfast-giants-causeway': [NA_SEASON, NA_SEASON, NA_SEASON, NA_SEASON, NA_SEASON, NA_SEASON, 'The lag-peak season\'s start — still genuinely marginal.', 'Same marginal conditions.', 'The warmest it gets, around 57°F — still no month is truly favorable.', NA_SEASON, NA_SEASON, NA_SEASON],
  bhutan: [NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, 'Monsoon season — rivers running high, not a swim consideration either way.', NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW],
  bordeaux: [NA_SEASON, 'Cold, minor option at best.', 'Same cold conditions.', 'Same cold conditions.', 'Same cold conditions.', 'A modest real window begins.', 'Same modest window.', 'Same modest window.', 'Same modest window.', 'Cooling.', NA_SEASON, NA_SEASON],
  cotswolds: [NA_SEASON, 'The same modest local options as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', NA_SEASON],
  'douro-valley-porto': Array(12).fill('Same cold-Atlantic, minor-option conditions year-round — this is a wine destination, not a beach one.'),
  everglades: [
    'Real alligator hazard, same as any other month.', 'Same hazard.', 'Same hazard.', 'Same hazard.',
    'Same hazard, entering the wet season.', 'Wet season — same hazard, rougher water too.', 'Same wet-season conditions.',
    'Same wet-season conditions.', 'Same wet-season conditions.', 'Same wet-season conditions.',
    'Dry season returns — same hazard regardless.', 'Same hazard.',
  ],
  'glacier-waterton': [NA_SEASON, NA_SEASON, NA_SEASON, NA_SEASON, 'A short real window begins.', 'Same real window.', 'Same real window.', 'Same real window.', 'Same real window.', 'Same real window, cooling.', NA_SEASON, NA_SEASON],
  'hudson-valley': [NA_SEASON, NA_SEASON, 'Still cold; wine and scenery are the real draw.', 'Same cold conditions.', 'Warming, a minor window opening.', 'A modest real window for the swimming holes.', 'Same modest window.', 'Same modest window.', 'Same modest window.', 'Cooling.', 'Too cold again.', NA_SEASON],
  ireland: [NA_SEASON, NA_SEASON, NA_SEASON, 'Water around 48°F — still early, hardy-swimmer territory.', 'Same cold spring conditions.', 'Real, if modest, season begins.', 'Water near its warmest, around 66°F.', 'Same warm-for-Ireland conditions.', 'Still within the real season, cooling.', 'Same cooling conditions.', NA_SEASON, NA_SEASON],
  'lake-district': [NA_SEASON, NA_SEASON, 'Lakes still cold.', 'Same cold conditions.', 'Same cold conditions, warming slowly.', 'Real season begins.', 'Peak season, into the 60s°F.', 'Same peak conditions.', 'Still within the real season.', 'Cooling back down.', 'Same cooling conditions.', NA_SEASON],
  nepal: [NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, 'Monsoon season begins — rivers running high, not a swim consideration either way.', NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW, NOT_A_DRAW],
  'new-orleans': [NA_SEASON, 'Not the real draw here, same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', NA_SEASON],
  olympic: [NA_SEASON, NA_SEASON, NA_SEASON, NA_SEASON, 'Water around 50°F — genuinely too cold for real swimming.', 'Same cold conditions.', 'The warmest it gets, still only the high 50s°F.', 'Same peak (still cold) conditions.', 'Same peak (still cold) conditions.', 'Cooling below even that.', NA_SEASON, NA_SEASON],
  'quebec-city': [NA_SEASON, NA_SEASON, NA_SEASON, 'Still cold; the river is scenery, not a swim spot, most of the year.', 'Same cold conditions.', 'A modest real window begins.', 'Same modest window.', 'Same modest window.', 'Same modest window.', 'Cooling.', 'Same cooling conditions.', NA_SEASON],
  redwood: [NA_SEASON, NA_SEASON, 'Cold, upwelling-fed water — a wetsuit matters here in every season.', 'Same cold conditions.', 'Same cold conditions.', 'A modest real window begins.', 'Same modest window.', 'Same modest window.', 'Same modest window.', 'Cooling.', NA_SEASON, NA_SEASON],
  rioja: [NA_SEASON, 'Incidental at best, same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', 'Same as any other month.', NA_SEASON],
  'scottish-highlands-skye': [NA_SEASON, NA_SEASON, 'Water still cold.', 'Same cold conditions.', 'Same cold conditions.', 'Real, if bracing, season begins.', 'Water near its warmest, still only 55-59°F.', 'Same peak (still cold) conditions.', 'Still within the real season, cooling.', 'Same cooling conditions.', NA_SEASON, NA_SEASON],
  snowdonia: [NA_SEASON, NA_SEASON, 'Water still cold.', 'Same cold conditions.', 'Same cold conditions, warming slowly.', 'Real season begins.', 'Peak season, into the low 60s°F.', 'Same peak conditions.', 'Still within the real season.', 'Cooling back down.', 'Same cooling conditions.', NA_SEASON],
  'st-andrews-fife': [NA_SEASON, NA_SEASON, 'Still cold, a brief window opening.', 'Same cold conditions.', 'Same cold conditions.', 'A brief, hardy real window.', 'Same brief window.', 'Same brief window.', 'Same brief window.', 'Cooling.', NA_SEASON, NA_SEASON],
  'zion-bryce': [
    NA_SEASON, NA_SEASON, 'Spring runoff — the Narrows may be closed to hiking/wading outright.', 'Same high-runoff conditions.',
    'Runoff easing; the Narrows may reopen.', 'Real season — cold, snowmelt-fed water.', NA_SEASON, NA_SEASON,
    'Real season resumes as flash-flood risk eases.', 'Same real-season conditions.', 'Same real-season conditions.', NA_SEASON,
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
