import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'whaleWatching';

// Syncs monthly blurb text to the new curves applied in
// fix-whalewatching-audit-findings.ts — several months now say the
// opposite of what the (corrected) score implies.

const OVERVIEWS: Record<string, string> = {
  'monterey-big-sur': "Monterey Bay's deep underwater canyon brings whales close to shore nearly year-round. Gray whales pass twice annually on their migration between Arctic feeding grounds and Baja breeding lagoons — southbound in a genuine mid-winter peak around January, then north again with mothers and calves passing especially close to shore each spring.",
  falklands: "Southern right whales, sei whales, and orcas are present in Falklands waters, with sightings concentrated within the islands' wider austral-summer wildlife season (Oct-Mar) rather than a separate winter window — still mostly incidental to the penguin- and seabird-focused tours rather than a dedicated product.",
};

const MONTHLY: Record<string, string[]> = {
  'monterey-big-sur': [
    'Peak southbound gray whale migration — the single best month of the year, as whales head for Baja breeding lagoons.',
    'Southbound migration is easing; whales are present at a good baseline.',
    'Whales are present at a good baseline as the early northbound migration gets underway.',
    'Whales are present at a good baseline; the northbound migration is building toward its own peak.',
    'Peak northbound gray whale migration, with mothers and calves passing especially close to shore.',
    "Whales are present in Monterey Bay's productive waters year-round, at a steady baseline.",
    "Whales are present in Monterey Bay's productive waters year-round, at a steady baseline.",
    "Whales are present in Monterey Bay's productive waters year-round, at a steady baseline.",
    "Whales are present in Monterey Bay's productive waters year-round, at a steady baseline.",
    "Whales are present in Monterey Bay's productive waters year-round, at a steady baseline.",
    "Whales are present in Monterey Bay's productive waters year-round, at a steady baseline.",
    'The southbound gray whale migration is beginning to build toward its January peak.',
  ],
  falklands: [
    'Peak season — whale sightings are at their best within the islands\' wider austral-summer wildlife season.',
    'Whale numbers remain strong within the wider austral-summer wildlife season.',
    'Whale sightings are easing as the austral summer winds down.',
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.',
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.',
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.',
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.',
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.',
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.',
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.',
    'Outside the whale season, sightings settle to a quieter baseline alongside the islands\' penguin and seabird wildlife.',
    'Whale numbers are beginning to build as the austral summer wildlife season begins.',
  ],
  cornwall: [
    'Outside the main season, trips settle to a quieter baseline.',
    'Outside the main season, trips settle to a quieter baseline.',
    'Outside the main season, trips settle to a quieter baseline.',
    'The season is beginning at its real April peak, with minke whales a regular sighting.',
    'Whale numbers remain strong as the season continues.',
    'Whale numbers continue building through the season.',
    'Peak season — minke whales are a regular sighting alongside dolphins, porpoises, and basking sharks.',
    'Peak season — minke whales are a regular sighting alongside dolphins, porpoises, and basking sharks.',
    'Whale numbers remain good as the season continues.',
    'Whale numbers remain good as the season continues.',
    'The long season is winding down, with occasional minke whale sightings.',
    'Outside the main season, trips settle to a quieter baseline.',
  ],
  rio: [
    'Outside the whale season, sightings near the Cagarras Islands settle to a quiet baseline.',
    'Outside the whale season, sightings near the Cagarras Islands settle to a quiet baseline.',
    'Outside the whale season, sightings near the Cagarras Islands settle to a quiet baseline.',
    'Whale numbers are beginning to build as the season approaches.',
    'Whale numbers are beginning to build as the season approaches.',
    'Whale numbers are building quickly as the season gets underway.',
    "Peak season — humpback whales pass close to Rio's coast near the Cagarras Islands.",
    'Whale numbers remain strong as the peak season continues.',
    'Whale numbers remain strong as the season continues.',
    'Whale numbers remain good, easing gradually as the season winds down.',
    'Whale numbers are easing as the season winds down.',
    'Outside the whale season, sightings near the Cagarras Islands settle to a quiet baseline.',
  ],
  tasmania: [
    'Outside the migration passages, whale sightings off Tasmania settle to a quieter baseline.',
    'Outside the migration passages, whale sightings off Tasmania settle to a quieter baseline.',
    'Outside the migration passages, whale sightings off Tasmania settle to a quieter baseline.',
    'Outside the migration passages, whale sightings off Tasmania settle to a quieter baseline.',
    'Whales are beginning their northbound migration past Tasmania toward mainland breeding grounds.',
    'Peak northbound migration — humpback and southern right whales pass Tasmania in strong numbers.',
    'The tail end of the northbound migration — whale numbers remain good as most whales reach their breeding grounds further north.',
    'Whales are at their breeding grounds further north; sightings off Tasmania are at their lowest.',
    'Peak southbound migration begins — humpback and southern right whales pass Tasmania in strong numbers heading back to Antarctic feeding grounds.',
    'Peak southbound migration continues in strong numbers.',
    'The southbound migration is easing as whales continue toward Antarctic feeding grounds.',
    'Outside the migration passages, whale sightings off Tasmania settle to a quieter baseline.',
  ],
  'tierra-del-fuego': [
    'Peak austral summer season — southern right and other whales are present in the waters around Tierra del Fuego.',
    'Peak austral summer season — southern right and other whales are present in the waters around Tierra del Fuego.',
    'Peak austral summer season — southern right and other whales are present in the waters around Tierra del Fuego.',
    'The tail end of the austral summer season — whale sightings remain a real possibility before easing to baseline.',
    'Outside the austral summer, whale sightings around Tierra del Fuego settle to a quieter baseline.',
    'Outside the austral summer, whale sightings around Tierra del Fuego settle to a quieter baseline.',
    'Outside the austral summer, whale sightings around Tierra del Fuego settle to a quieter baseline.',
    'Outside the austral summer, whale sightings around Tierra del Fuego settle to a quieter baseline.',
    'Outside the austral summer, whale sightings around Tierra del Fuego settle to a quieter baseline.',
    'Outside the austral summer, whale sightings around Tierra del Fuego settle to a quieter baseline.',
    'The austral summer season is beginning, with whale sightings building toward the peak.',
    'Peak austral summer season — southern right and other whales are present in the waters around Tierra del Fuego.',
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
