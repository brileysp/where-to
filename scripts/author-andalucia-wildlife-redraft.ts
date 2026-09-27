import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { MONTH_NAMES } from '../src/lib/scoring/constants';

// Andalucía's wildlifeViewing was never actually authored month-by-month —
// every month held the generic "not a dedicated focus" placeholder, and
// scoreOverrides had a flat, backwards curve (low in winter, up in summer)
// that didn't reflect real Iberian Lynx seasonality at all. This fills in
// both from a lynx-sighting-odds table (4 venue types x 12 months) plus a
// factual check on Spanish Ibex reliability at El Torcal (see chat).
//
// Per the user's direction: no named hide/estate brands (those become
// their own sub-places later) — venues are described generically as
// "public viewpoints"/"mountain hides" (Sierra de Andújar, winter-favoring)
// vs. "dedicated lynx photography hides on private estates" (summer-
// favoring, water-concentrated). Ibex lives only in the year-round
// overview, not repeated in every month. Jul/Aug share identical source
// data (2,3,7,2 across all four venues) so they intentionally share the
// exact same blurb and score — not "conditions mirror July" hand-waving.
const KEY = 'wildlifeViewing';
const ANDALUCIA_ID = 'andalucia';

const NEW_OVERVIEW =
  "Spanish Ibex are the reliable, year-round sighting — herds roam the trails of El Torcal de Antequera and are easiest to spot early or late in the day, away from the crowds. Iberian Lynx, one of the world's rarest cats, is the real draw: the Sierra de Andújar offers some of the best combined odds anywhere for the species, especially in winter, and dedicated photography hides on private estates keep producing sightings through the summer months when public viewing quiets down.";

const JUL_AUG_BLURB =
  'Private-estate hides remain the strongest bet for lynx, with sessions run around dawn and dusk to work around the heat — cubs occasionally appear alongside adults at the waterhole. General daytime wildlife viewing elsewhere is at its toughest all year.';

const NEW_MONTHS: string[] = [
  'This is peak Iberian Lynx season in the Sierra de Andújar — cooler weather and the mating season put cats on the move, and public viewpoints and mountain hides both post their best odds of the year.',
  "Andújar stays at its winter peak for Iberian Lynx, with public viewpoints and mountain hides both still running near their best odds — the mating season keeps cats visibly active.",
  'Lynx sightings around Andújar ease slightly as the mating season winds down, though public viewpoints and mountain hides are still productive most mornings.',
  "Lynx activity around Andújar continues to soften into spring; odds spread more evenly between public viewpoints and dedicated lynx photography hides on private estates rather than favoring any one approach.",
  "As Andújar's public viewpoints quiet down, dedicated lynx photography hides on private estates start picking up — rising temperatures concentrate lynx and prey around managed water sources, and dedicated photographers increasingly prefer this window.",
  "Private-estate photography hides hit their best odds of the year as the heat concentrates lynx around water; Andújar's public viewpoints, by contrast, are at their quietest.",
  JUL_AUG_BLURB,
  JUL_AUG_BLURB,
  "Private-estate hides are still productive through prolonged dry spells, though a touch past their summer peak; Andújar's public viewpoints begin a slow recovery as the heat breaks.",
  "The year's quietest stretch — Andújar's public viewpoints, mountain hides, and private-estate hides are all past their best, and none has fully picked up the slack yet.",
  'Cooling temperatures start reviving daytime lynx activity around Andújar, with mountain hides leading the recovery ahead of the winter peak.',
  "Andújar builds back toward its winter best — public viewpoints and mountain hides are both trending up again as cooler weather returns, with the mating season just ahead.",
];

const NEW_SCORES: Record<number, number> = {
  0: 7.4, // Jan — winter peak, multiple venues strong at once
  1: 7.4, // Feb — same conditions hold
  2: 6.6, // Mar — still good, easing off the peak
  3: 5.5, // Apr — transition, odds spreading thinner
  4: 5.7, // May — private-estate hides waking up
  5: 5.9, // Jun — private-estate best window opens, just ahead of Jul/Aug
  6: 5.6, // Jul — private-estate strong, general viewing hardest all year
  7: 5.6, // Aug — identical source data to Jul
  8: 5.3, // Sep — private-estate past peak, still workable
  9: 4.2, // Oct — year's low point
  10: 4.9, // Nov — recovery begins
  11: 6.9, // Dec — building back toward winter peak
};

if (NEW_MONTHS.length !== 12) throw new Error(`expected 12 month blurbs, got ${NEW_MONTHS.length}`);
if (Object.keys(NEW_SCORES).length !== 12) throw new Error('expected 12 score entries');

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
  if (!env.DATABASE_URL) {
    console.error('No DATABASE_URL in .env.local');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  const [row] = await db.select().from(places).where(eq(places.id, ANDALUCIA_ID));
  if (!row) {
    console.error(`no place with id "${ANDALUCIA_ID}"`);
    process.exit(1);
  }

  const oldOverview = (row.sliderOverview as Record<string, string> | null)?.[KEY] ?? '';
  const oldMonths = (row.sliderMonthlyWeather as Record<string, (string | null)[]> | null)?.[KEY] ?? new Array(12).fill(null);
  const oldScores = (row.scoreOverrides as Record<string, Record<number, number>> | null)?.[KEY] ?? {};

  const patch = {
    sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: NEW_OVERVIEW },
    sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: NEW_MONTHS },
    scoreOverrides: { ...(row.scoreOverrides as Record<string, unknown>), [KEY]: NEW_SCORES },
  };

  console.log(`${row.name} (${ANDALUCIA_ID}) — ${KEY}\n`);
  console.log('overview:');
  console.log('  before:', oldOverview || '(none)');
  console.log('  after: ', NEW_OVERVIEW);
  console.log('\nmonths:');
  for (let i = 0; i < 12; i++) {
    const before = oldScores[i];
    const after = NEW_SCORES[i];
    console.log(`  ${MONTH_NAMES[i].padEnd(10)} ${String(before ?? '—').padEnd(6)} -> ${after}`);
    if (oldMonths[i] !== NEW_MONTHS[i]) console.log(`             text updated`);
  }

  if (dryRun) {
    console.log('\n\ndry run — nothing written.');
    process.exit(0);
  }

  const after = { ...row, ...patch };
  await db.transaction(async (tx) => {
    await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, ANDALUCIA_ID));
    await tx.insert(adminAuditLog).values({
      actorId: '00000000-0000-0000-0000-000000000000',
      entityType: 'destination',
      entityId: ANDALUCIA_ID,
      action: 'update',
      beforeValue: row,
      afterValue: after,
    });
  });

  console.log('\n\ndone — written to sliderOverview / sliderMonthlyWeather / scoreOverrides.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
