import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Ninth batch — desert/dryland specialists (Atacama, Jordan, Morocco,
 * Uzbekistan). Morocco already has real spring/autumn passage events from
 * this session's earlier model-based fix. Uzbekistan stays genuinely
 * flat, same discipline as Lapland/Kyrgyzstan.
 */

const KEY = 'birding';

const OVERVIEWS: Record<string, string> = {
  atacama: 'High-altitude salt-flat lagoons hold three flamingo species — Andean, Chilean, and the rare James\'s flamingo — feeding in the mineral-rich shallows.',
  jordan: 'Jordan sits on a genuine Palearctic-African migration flyway, with raptors and storks passing through the Great Rift Valley\'s northern extension each migration season.',
  morocco: 'Morocco sits on a major Western Palearctic-African migration flyway, with real spring and autumn passage through the High Atlas foothills alongside desert and mountain specialists.',
  uzbekistan: 'Steppe and desert species are present year-round in the region, though nothing here is tied to a specific seasonal spectacle.',
};

const MONTHLY: Record<string, string[]> = {
  atacama: [
    'Extreme high-altitude conditions limit access to the salt-flat lagoons.', // Jan
    'Extreme high-altitude conditions limit access to the salt-flat lagoons.', // Feb
    'Access remains difficult at this elevation; flamingo numbers are lower.', // Mar
    'Access remains difficult at this elevation; flamingo numbers are lower.', // Apr
    'Access remains difficult at this elevation; flamingo numbers are lower.', // May
    'Access remains difficult at this elevation; flamingo numbers are lower.', // Jun
    'Access remains difficult at this elevation; flamingo numbers are lower.', // Jul
    'Access remains difficult at this elevation; flamingo numbers are lower.', // Aug
    'Flamingo numbers build at the salt-flat lagoons as conditions ease.', // Sep
    'Flamingo numbers build at the salt-flat lagoons as conditions ease.', // Oct
    'Flamingo numbers build at the salt-flat lagoons as conditions ease.', // Nov
    'Flamingo numbers build at the salt-flat lagoons as conditions ease.', // Dec
  ],
  jordan: [
    'Wintering species and migration passage bring the strongest birding of the year.', // Jan
    'Wintering species and migration passage bring the strongest birding of the year.', // Feb
    'Wintering species and migration passage bring the strongest birding of the year.', // Mar
    'Outside the main migration and wintering windows, birding settles to a quieter desert baseline.', // Apr
    'Outside the main migration and wintering windows, birding settles to a quieter desert baseline.', // May
    'Outside the main migration and wintering windows, birding settles to a quieter desert baseline.', // Jun
    'Outside the main migration and wintering windows, birding settles to a quieter desert baseline.', // Jul
    'Outside the main migration and wintering windows, birding settles to a quieter desert baseline.', // Aug
    'Outside the main migration and wintering windows, birding settles to a quieter desert baseline.', // Sep
    'Outside the main migration and wintering windows, birding settles to a quieter desert baseline.', // Oct
    'Wintering species and migration passage bring the strongest birding of the year.', // Nov
    'Wintering species and migration passage bring the strongest birding of the year.', // Dec
  ],
  morocco: [
    'Outside the migration passage windows, birding settles to the resident baseline.', // Jan
    'Outside the migration passage windows, birding settles to the resident baseline.', // Feb
    'Spring migration passage adds significant numbers to the resident population.', // Mar
    'Spring migration passage adds significant numbers to the resident population.', // Apr
    'Outside the migration passage windows, birding settles to the resident baseline.', // May
    'Outside the migration passage windows, birding settles to the resident baseline.', // Jun
    'Outside the migration passage windows, birding settles to the resident baseline.', // Jul
    'Outside the migration passage windows, birding settles to the resident baseline.', // Aug
    'Autumn migration passage adds significant numbers to the resident population.', // Sep
    'Autumn migration passage adds significant numbers to the resident population.', // Oct
    'Autumn migration passage adds significant numbers to the resident population.', // Nov
    'Outside the migration passage windows, birding settles to the resident baseline.', // Dec
  ],
  uzbekistan: Array(12).fill('Present year-round; nothing here is tied to a specific seasonal spectacle.'),
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
