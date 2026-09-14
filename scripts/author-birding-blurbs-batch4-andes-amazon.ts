import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Fourth batch — the Andean-Amazon elevational gradient group (Colombian
 * Andes, Ecuadorian Andes, Peruvian Amazon; Cusco & Sacred Valley already
 * done as a sample). Ecuadorian Andes and Peruvian Amazon run on the
 * generic birdingPeak fallback rather than a real named event, but their
 * existing timing is ecologically plausible (Ecuador's June-September dry
 * season plus a short January dry spell locally called the "veranillo";
 * the Amazon's June-September low-water season) — good enough to write
 * real content against without a re-score.
 */

const KEY = 'birding';

const OVERVIEWS: Record<string, string> = {
  'colombian-andes': 'More recorded bird species than any other country on Earth — around 1,900 — concentrated in cloud forest and páramo habitats across three Andean mountain ranges. Hummingbird diversity here is exceptional, with dozens of species sometimes visible at a single feeder station.',
  'ecuadorian-andes': 'Over 130 hummingbird species recorded in Ecuador alone, alongside Andean condors soaring over páramo grassland. The elevational range from high páramo down through cloud forest concentrates an exceptional diversity into a small area.',
  'peruvian-amazon': 'Lowland rainforest and riverbank habitat hold some of the highest single-site species counts on Earth. Macaws and parrots gather at clay licks along the riverbanks, feeding on mineral-rich clay exposed as water levels drop.',
};

const MONTHLY: Record<string, string[]> = {
  'colombian-andes': [
    'North American migratory species overwinter alongside the resident population, adding to an already exceptional diversity.', // Jan
    'North American migratory species overwinter alongside the resident population, adding to an already exceptional diversity.', // Feb
    'North American migratory species overwinter alongside the resident population, adding to an already exceptional diversity.', // Mar
    'Migrants have departed; resident species carry the baseline.', // Apr
    'Migrants have departed; resident species carry the baseline.', // May
    'Dry-season conditions ease trail access into cloud forest sites.', // Jun
    'Dry-season conditions ease trail access into cloud forest sites.', // Jul
    'Dry-season conditions ease trail access into cloud forest sites.', // Aug
    'Migrants have not yet arrived; resident species carry the baseline.', // Sep
    'Migrants have not yet arrived; resident species carry the baseline.', // Oct
    'North American migratory species overwinter alongside the resident population, adding to an already exceptional diversity.', // Nov
    'North American migratory species overwinter alongside the resident population, adding to an already exceptional diversity.', // Dec
  ],
  'ecuadorian-andes': [
    'A short dry spell — locally called the "veranillo" — eases trail access into cloud forest sites.', // Jan
    'Wetter conditions make higher-elevation trails harder going.', // Feb
    'Wetter conditions make higher-elevation trails harder going.', // Mar
    'Wetter conditions make higher-elevation trails harder going.', // Apr
    'Conditions beginning to dry out ahead of the main dry season.', // May
    'The main dry season eases access across the full elevational range, from páramo down through cloud forest.', // Jun
    'The main dry season eases access across the full elevational range, from páramo down through cloud forest.', // Jul
    'The main dry season eases access across the full elevational range, from páramo down through cloud forest.', // Aug
    'Rains beginning to return.', // Sep
    'Wetter conditions make higher-elevation trails harder going.', // Oct
    'Wetter conditions make higher-elevation trails harder going.', // Nov
    'The veranillo dry spell returns.', // Dec
  ],
  'peruvian-amazon': [
    'High water levels submerge the riverbank clay licks and limit trail access into the forest interior.', // Jan
    'High water levels submerge the riverbank clay licks and limit trail access into the forest interior.', // Feb
    'High water levels submerge the riverbank clay licks and limit trail access into the forest interior.', // Mar
    'Water levels beginning to drop.', // Apr
    'Water levels beginning to drop.', // May
    'Low-water season exposes the riverbank clay licks where macaws and parrots gather, and eases trail access into the forest interior.', // Jun
    'Low-water season exposes the riverbank clay licks where macaws and parrots gather, and eases trail access into the forest interior.', // Jul
    'Low-water season exposes the riverbank clay licks where macaws and parrots gather, and eases trail access into the forest interior.', // Aug
    'Low-water season exposes the riverbank clay licks where macaws and parrots gather, and eases trail access into the forest interior.', // Sep
    'Water levels beginning to rise again.', // Oct
    'Water levels beginning to rise again.', // Nov
    'Rising water levels submerge the clay licks once more.', // Dec
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
