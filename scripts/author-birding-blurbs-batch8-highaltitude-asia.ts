import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Eighth batch — high-altitude Asian specialists (Nepal, Bhutan, Ladakh,
 * Kyrgyzstan, Mongolia). Bhutan and Ladakh both involve the black-necked
 * crane, at genuinely different life stages a continent apart in season:
 * Bhutan's Phobjikha Valley is a wintering ground (Nov-Feb), Ladakh's
 * Changthang plateau is a summer breeding ground (Jun-Aug) — the same
 * species, opposite halves of the year, correctly distinct in each
 * destination's real timing. Kyrgyzstan stays genuinely flat, same
 * discipline as Lapland — real specialists exist but no seasonal
 * spectacle to hang a claim on.
 */

const KEY = 'birding';

const OVERVIEWS: Record<string, string> = {
  nepal: 'Over 800 recorded species across a dramatic elevation range, from lowland Terai grassland up to high Himalayan passes. Spring and autumn trekking seasons give the best access to the full range.',
  bhutan: 'Black-necked cranes winter in the Phobjikha Valley, one of the most celebrated wildlife spectacles in the Himalayas, alongside a wider Himalayan bird diversity across the country\'s forested slopes.',
  ladakh: 'The Changthang plateau is a genuine summer breeding ground for black-necked cranes, alongside other high-altitude Trans-Himalayan specialists found at extreme elevation.',
  kyrgyzstan: 'High-altitude Tian Shan specialists and raptors are present, along with Issyk-Kul lake as a stopover point, though nothing here is tied to a specific seasonal spectacle.',
  mongolia: 'Steppe and desert specialists — including the relict gull, one of the rarest gull species on Earth, breeding at a single Mongolian lake — are present during the short summer window.',
};

const MONTHLY: Record<string, string[]> = {
  nepal: [
    'Cool, dry conditions but before the main trekking season begins.', // Jan
    'Spring trekking season gives good access across the elevation range.', // Feb
    'Spring trekking season gives good access across the elevation range.', // Mar
    'Spring trekking season gives good access across the elevation range.', // Apr
    'Conditions warming ahead of the monsoon.', // May
    'Monsoon rains limit trail access across the country.', // Jun
    'Monsoon rains limit trail access across the country.', // Jul
    'Monsoon rains limit trail access across the country.', // Aug
    'Monsoon rains limit trail access across the country.', // Sep
    'Autumn trekking season — the clearest, most reliable access of the year.', // Oct
    'Autumn trekking season — the clearest, most reliable access of the year.', // Nov
    'Cool, dry conditions after the main trekking season has ended.', // Dec
  ],
  bhutan: [
    'Black-necked cranes winter in the Phobjikha Valley, one of the most celebrated wildlife spectacles in the Himalayas.', // Jan
    'Black-necked cranes winter in the Phobjikha Valley, one of the most celebrated wildlife spectacles in the Himalayas.', // Feb
    'Cranes have migrated elsewhere; forest birding continues at a solid baseline.', // Mar
    'Cranes have migrated elsewhere; forest birding continues at a solid baseline.', // Apr
    'Cranes have migrated elsewhere; forest birding continues at a solid baseline.', // May
    'Monsoon rains make trail conditions harder across the country.', // Jun
    'Monsoon rains make trail conditions harder across the country.', // Jul
    'Monsoon rains make trail conditions harder across the country.', // Aug
    'Cranes have migrated elsewhere; forest birding continues at a solid baseline.', // Sep
    'Cranes have migrated elsewhere; forest birding continues at a solid baseline.', // Oct
    'Black-necked cranes winter in the Phobjikha Valley, one of the most celebrated wildlife spectacles in the Himalayas.', // Nov
    'Black-necked cranes winter in the Phobjikha Valley, one of the most celebrated wildlife spectacles in the Himalayas.', // Dec
  ],
  ladakh: [
    'Not accessible this month — extreme winter conditions close the high passes.', // Jan
    'Not accessible this month — extreme winter conditions close the high passes.', // Feb
    'Access is possible but conditions remain cold at this elevation.', // Mar
    'Access is possible but conditions remain cold at this elevation.', // Apr
    'Access is possible but conditions remain cold at this elevation.', // May
    'Summer breeding season for black-necked cranes on the Changthang plateau, when high-altitude passes are most reliably open.', // Jun
    'Summer breeding season for black-necked cranes on the Changthang plateau, when high-altitude passes are most reliably open.', // Jul
    'Summer breeding season for black-necked cranes on the Changthang plateau, when high-altitude passes are most reliably open.', // Aug
    'Access is possible but conditions remain cold at this elevation.', // Sep
    'Access is possible but conditions remain cold at this elevation.', // Oct
    'Access is possible but conditions remain cold at this elevation.', // Nov
    'Not accessible this month — extreme winter conditions close the high passes.', // Dec
  ],
  kyrgyzstan: Array(12).fill('Present year-round; nothing here is tied to a specific seasonal spectacle.'),
  mongolia: [
    'Outside the short summer window, harsh conditions limit both access and bird activity.', // Jan
    'Outside the short summer window, harsh conditions limit both access and bird activity.', // Feb
    'Outside the short summer window, harsh conditions limit both access and bird activity.', // Mar
    'Outside the short summer window, harsh conditions limit both access and bird activity.', // Apr
    'Summer breeding season for steppe and desert specialists, including the relict gull at its single breeding lake.', // May
    'Summer breeding season for steppe and desert specialists, including the relict gull at its single breeding lake.', // Jun
    'Summer breeding season for steppe and desert specialists, including the relict gull at its single breeding lake.', // Jul
    'Summer breeding season for steppe and desert specialists, including the relict gull at its single breeding lake.', // Aug
    'Outside the short summer window, harsh conditions limit both access and bird activity.', // Sep
    'Outside the short summer window, harsh conditions limit both access and bird activity.', // Oct
    'Outside the short summer window, harsh conditions limit both access and bird activity.', // Nov
    'Outside the short summer window, harsh conditions limit both access and bird activity.', // Dec
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
