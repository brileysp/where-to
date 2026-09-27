import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Third batch of the birding content-authoring project — Central American
 * migration bottleneck & tropical diversity (Costa Rica, Panama,
 * Guatemala, Nicaragua; Belize already done as a sample). Same
 * habitat-level lens as prior batches.
 */

const KEY = 'birding';

const OVERVIEWS: Record<string, string> = {
  'costa-rica': 'Roughly 900 recorded species packed into a small area — Pacific and Caribbean slopes plus a full elevation gradient from lowland rainforest to cloud forest. Resplendent quetzals display in the cloud forest canopy; scarlet macaws work the lowland Pacific coast.',
  panama: 'Over 1,000 recorded species, including one of the largest raptor migrations on Earth funneling through the narrow isthmus each fall. Broad-winged hawks, Swainson\'s hawks, and turkey vultures pass overhead by the tens of thousands.',
  guatemala: 'Highland cloud forest and lowland rainforest around Tikal hold a real diversity of resident species, joined by wintering North American migrants through the dry season.',
  nicaragua: 'Pacific volcanic highlands and the Rio San Juan lowlands hold a real, if less internationally known, diversity of resident species, joined by wintering North American migrants through the dry season.',
};

const MONTHLY: Record<string, string[]> = {
  'costa-rica': [
    'Quetzal breeding display season in the cloud forest — males show their long tail feathers near nest cavities. Dry conditions also make trails easier throughout.', // Jan
    'Quetzal breeding display season in the cloud forest — males show their long tail feathers near nest cavities. Dry conditions also make trails easier throughout.', // Feb
    'Quetzal breeding display season in the cloud forest — males show their long tail feathers near nest cavities. Dry conditions also make trails easier throughout.', // Mar
    'Quetzal breeding display season in the cloud forest — males show their long tail feathers near nest cavities. Dry conditions also make trails easier throughout.', // Apr
    'Quetzals have finished displaying and gone quieter; general lowland and coastal birding continues at a strong baseline.', // May
    'Quetzals have finished displaying and gone quieter; general lowland and coastal birding continues at a strong baseline.', // Jun
    'Quetzals have finished displaying and gone quieter; general lowland and coastal birding continues at a strong baseline.', // Jul
    'Quetzals have finished displaying and gone quieter; general lowland and coastal birding continues at a strong baseline.', // Aug
    'Heaviest rains of the year make trail conditions harder in both cloud forest and lowland sites.', // Sep
    'Heaviest rains of the year make trail conditions harder in both cloud forest and lowland sites.', // Oct
    'Rains easing; conditions improving ahead of the dry season.', // Nov
    'Quetzal display season begins again as the dry season returns.', // Dec
  ],
  panama: [
    'Spring raptor passage adds to the resident diversity, alongside wintering migrants still present.', // Jan
    'Spring raptor passage adds to the resident diversity, alongside wintering migrants still present.', // Feb
    'Spring raptor passage adds to the resident diversity, alongside wintering migrants still present.', // Mar
    'Spring raptor passage adds to the resident diversity, alongside wintering migrants still present.', // Apr
    'The main migration windows have passed; birding continues at a resident-species baseline.', // May
    'The main migration windows have passed; birding continues at a resident-species baseline.', // Jun
    'The main migration windows have passed; birding continues at a resident-species baseline.', // Jul
    'The main migration windows have passed; birding continues at a resident-species baseline.', // Aug
    'The main migration windows have passed; birding continues at a resident-species baseline.', // Sep
    'Peak fall raptor migration — the isthmus funnels enormous numbers of hawks and vultures south, with single-day counts reaching the tens of thousands.', // Oct
    'Peak fall raptor migration — the isthmus funnels enormous numbers of hawks and vultures south, with single-day counts reaching the tens of thousands.', // Nov
    'Wintering migrants have arrived and settled in alongside residents.', // Dec
  ],
  guatemala: [
    'Wintering migrants are settled in alongside residents; dry conditions make highland and lowland trails easier.', // Jan
    'Wintering migrants are settled in alongside residents; dry conditions make highland and lowland trails easier.', // Feb
    'Wintering migrants are settled in alongside residents; dry conditions make highland and lowland trails easier.', // Mar
    'Migrants have largely departed; trail conditions remain workable before the rains set in fully.', // Apr
    'Migrants have largely departed; trail conditions remain workable before the rains set in fully.', // May
    'Wet season; heavier rain makes both highland cloud forest and lowland rainforest trails harder going.', // Jun
    'Wet season; heavier rain makes both highland cloud forest and lowland rainforest trails harder going.', // Jul
    'Wet season; heavier rain makes both highland cloud forest and lowland rainforest trails harder going.', // Aug
    'Wet season; heavier rain makes both highland cloud forest and lowland rainforest trails harder going.', // Sep
    'Rains beginning to ease.', // Oct
    'Wintering migrants arrive and dry conditions return.', // Nov
    'Wintering migrants arrive and dry conditions return.', // Dec
  ],
  nicaragua: [
    'Wintering migrants are settled in alongside residents; dry conditions ease trail access.', // Jan
    'Wintering migrants are settled in alongside residents; dry conditions ease trail access.', // Feb
    'Wintering migrants are settled in alongside residents; dry conditions ease trail access.', // Mar
    'Migrants have largely departed as the dry season ends.', // Apr
    'Migrants have largely departed as the dry season ends.', // May
    'Wet season; heavier rain makes trails harder going across both the highlands and lowlands.', // Jun
    'Wet season; heavier rain makes trails harder going across both the highlands and lowlands.', // Jul
    'Wet season; heavier rain makes trails harder going across both the highlands and lowlands.', // Aug
    'Wet season; heavier rain makes trails harder going across both the highlands and lowlands.', // Sep
    'Wet season; heavier rain makes trails harder going across both the highlands and lowlands.', // Oct
    'Rains beginning to ease.', // Nov
    'Wintering migrants arrive and dry conditions return.', // Dec
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
