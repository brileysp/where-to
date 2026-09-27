import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Sixth batch — seabird/pelagic colony destinations (Lofoten, Falklands,
 * Faroe Islands, Iceland, Scottish Highlands & Isle of Skye, Milford
 * Sound & Fiordland). A genuinely different mechanism from every prior
 * batch — breeding-colony arrival/chick-rearing/departure, often one
 * sharp seasonal peak rather than a gradient.
 */

const KEY = 'birding';

const OVERVIEWS: Record<string, string> = {
  lofoten: 'White-tailed eagles patrol the fjords year-round, while seabird cliffs fill with breeding puffins, guillemots, and kittiwakes each summer.',
  falklands: 'Five penguin species breed here, from king penguins to rockhopper colonies, alongside one of the world\'s largest black-browed albatross colonies.',
  'faroe-islands': 'Steep sea cliffs hold dense colonies of Atlantic puffins alongside other North Atlantic seabirds.',
  iceland: 'Puffin colonies line the sea cliffs each summer, alongside Arctic terns and a strong wetland breeding-bird population.',
  'scottish-highlands-skye': 'Golden eagles and reintroduced white-tailed sea eagles work the highland glens, while smaller offshore islands hold seasonal seabird colonies.',
  'milford-sound-fiordland': 'The rare Fiordland crested penguin — one of the least numerous penguin species on Earth — breeds along this coastline, alongside the region\'s forest-endemic birdlife.',
};

const MONTHLY: Record<string, string[]> = {
  lofoten: [
    'Seabird cliffs stand empty outside the short Arctic breeding season; white-tailed eagles remain the main year-round draw.', // Jan
    'Seabird cliffs stand empty outside the short Arctic breeding season; white-tailed eagles remain the main year-round draw.', // Feb
    'Seabird cliffs stand empty outside the short Arctic breeding season; white-tailed eagles remain the main year-round draw.', // Mar
    'Seabird cliffs stand empty outside the short Arctic breeding season; white-tailed eagles remain the main year-round draw.', // Apr
    'Seabird cliffs fill with breeding puffins, guillemots, and kittiwakes during the short Arctic summer.', // May
    'Seabird cliffs fill with breeding puffins, guillemots, and kittiwakes during the short Arctic summer.', // Jun
    'Seabird cliffs fill with breeding puffins, guillemots, and kittiwakes during the short Arctic summer.', // Jul
    'Seabird cliffs stand empty outside the short Arctic breeding season; white-tailed eagles remain the main year-round draw.', // Aug
    'Seabird cliffs stand empty outside the short Arctic breeding season; white-tailed eagles remain the main year-round draw.', // Sep
    'Seabird cliffs stand empty outside the short Arctic breeding season; white-tailed eagles remain the main year-round draw.', // Oct
    'Seabird cliffs stand empty outside the short Arctic breeding season; white-tailed eagles remain the main year-round draw.', // Nov
    'Seabird cliffs stand empty outside the short Arctic breeding season; white-tailed eagles remain the main year-round draw.', // Dec
  ],
  falklands: [
    'Peak penguin and albatross breeding season — colonies are at their most active with chicks present.', // Jan
    'Peak penguin and albatross breeding season — colonies are at their most active with chicks present.', // Feb
    'Breeding season has wound down; birds remain present but colonies are quieter.', // Mar
    'Breeding season has wound down; birds remain present but colonies are quieter.', // Apr
    'Breeding season has wound down; birds remain present but colonies are quieter.', // May
    'Breeding season has wound down; birds remain present but colonies are quieter.', // Jun
    'Breeding season has wound down; birds remain present but colonies are quieter.', // Jul
    'Breeding season has wound down; birds remain present but colonies are quieter.', // Aug
    'Breeding season has wound down; birds remain present but colonies are quieter.', // Sep
    'Breeding season has wound down; birds remain present but colonies are quieter.', // Oct
    'Peak penguin and albatross breeding season — colonies are at their most active with chicks present.', // Nov
    'Peak penguin and albatross breeding season — colonies are at their most active with chicks present.', // Dec
  ],
  'faroe-islands': [
    'Puffins are away at sea outside the breeding season; cliffs are much quieter.', // Jan
    'Puffins are away at sea outside the breeding season; cliffs are much quieter.', // Feb
    'Puffins are away at sea outside the breeding season; cliffs are much quieter.', // Mar
    'Puffins are away at sea outside the breeding season; cliffs are much quieter.', // Apr
    'Puffins begin returning to the cliffs to breed.', // May
    'Peak puffin nesting season on the sea cliffs.', // Jun
    'Peak puffin nesting season on the sea cliffs.', // Jul
    'Puffins beginning to depart as the breeding season winds down.', // Aug
    'Puffins are away at sea outside the breeding season; cliffs are much quieter.', // Sep
    'Puffins are away at sea outside the breeding season; cliffs are much quieter.', // Oct
    'Puffins are away at sea outside the breeding season; cliffs are much quieter.', // Nov
    'Puffins are away at sea outside the breeding season; cliffs are much quieter.', // Dec
  ],
  iceland: [
    'Outside the summer breeding season, seabird cliffs are much quieter.', // Jan
    'Outside the summer breeding season, seabird cliffs are much quieter.', // Feb
    'Outside the summer breeding season, seabird cliffs are much quieter.', // Mar
    'Outside the summer breeding season, seabird cliffs are much quieter.', // Apr
    'Puffin colonies and Arctic tern nesting are at their peak on the sea cliffs and coastal wetlands.', // May
    'Puffin colonies and Arctic tern nesting are at their peak on the sea cliffs and coastal wetlands.', // Jun
    'Puffin colonies and Arctic tern nesting are at their peak on the sea cliffs and coastal wetlands.', // Jul
    'Outside the summer breeding season, seabird cliffs are much quieter.', // Aug
    'Outside the summer breeding season, seabird cliffs are much quieter.', // Sep
    'Outside the summer breeding season, seabird cliffs are much quieter.', // Oct
    'Outside the summer breeding season, seabird cliffs are much quieter.', // Nov
    'Outside the summer breeding season, seabird cliffs are much quieter.', // Dec
  ],
  'scottish-highlands-skye': [
    'Eagles remain year-round, but seabird colonies are quiet outside the breeding season.', // Jan
    'Eagles remain year-round, but seabird colonies are quiet outside the breeding season.', // Feb
    'Eagles remain year-round, but seabird colonies are quiet outside the breeding season.', // Mar
    'Breeding season brings seabird colonies to their offshore island cliffs, alongside resident eagle activity.', // Apr
    'Breeding season brings seabird colonies to their offshore island cliffs, alongside resident eagle activity.', // May
    'Breeding season brings seabird colonies to their offshore island cliffs, alongside resident eagle activity.', // Jun
    'Eagles remain year-round, but seabird colonies are quiet outside the breeding season.', // Jul
    'Eagles remain year-round, but seabird colonies are quiet outside the breeding season.', // Aug
    'Eagles remain year-round, but seabird colonies are quiet outside the breeding season.', // Sep
    'Eagles remain year-round, but seabird colonies are quiet outside the breeding season.', // Oct
    'Eagles remain year-round, but seabird colonies are quiet outside the breeding season.', // Nov
    'Eagles remain year-round, but seabird colonies are quiet outside the breeding season.', // Dec
  ],
  'milford-sound-fiordland': [
    'Fiordland crested penguin chicks are still present before fledging.', // Jan
    'Breeding season has wound down; penguins have largely dispersed to sea.', // Feb
    'Breeding season has wound down; penguins have largely dispersed to sea.', // Mar
    'Breeding season has wound down; penguins have largely dispersed to sea.', // Apr
    'Penguins are away at sea for the winter months.', // May
    'Penguins are away at sea for the winter months.', // Jun
    'Penguins are away at sea for the winter months.', // Jul
    'Penguins are away at sea for the winter months.', // Aug
    'Penguins are away at sea for the winter months.', // Sep
    'Breeding season has wound down; penguins have largely dispersed to sea.', // Oct
    'Fiordland crested penguins return to breed along the coastline.', // Nov
    'Fiordland crested penguins return to breed along the coastline.', // Dec
  ],
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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

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
