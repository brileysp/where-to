import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Fourteenth batch — Mediterranean/wine-country/island destinations.
 * Andalucía, Provence, and Sicily just had real events authored
 * (fix-mediterranean-birding-gaps.ts) and get matching month-by-month
 * text here. Rajasthan already had real generic curve variation (dry
 * winter season vs. hot monsoon-adjacent months) that happens to align
 * with the real Keoladeo/Bharatpur wintering-waterfowl season, so it
 * gets real monthly text without any score change. The rest are
 * genuinely flat, with real specific facts where they exist (Madeira's
 * Zino's petrel, the Azores' transatlantic vagrants, Mallorca's
 * S'Albufera, Sardinia's flamingos, St Andrews' nearby Isle of May).
 */

const KEY = 'birding';

const OVERVIEWS: Record<string, string> = {
  andalucia: 'The Strait of Gibraltar is one of the world\'s great raptor migration bottlenecks, funneling huge numbers of birds between Europe and Africa each spring and autumn. Doñana\'s wetlands add a second, separate wintering-waterfowl spectacle.',
  provence: 'The Camargue wetlands are one of Europe\'s great greater-flamingo breeding strongholds, alongside large heron and egret colonies.',
  sicily: 'The Strait of Messina is a real raptor migration corridor, most active during the spring passage of honey buzzards and other raptors heading north into Europe.',
  'rajasthan-golden-triangle': 'Keoladeo Ghat National Park near Bharatpur is a world-renowned wetland sanctuary and a major wintering ground for migratory waterfowl.',
};

const MONTHLY: Record<string, string[]> = {
  andalucia: [
    'Doñana\'s wintering waterfowl are present in strong numbers.', // Jan
    'Doñana\'s wintering waterfowl remain present, though numbers are easing.', // Feb
    'Outside the migration and wintering windows, birding settles to a quieter baseline.', // Mar
    'Spring raptor migration is building across the Strait of Gibraltar.', // Apr
    'Spring raptor migration continues across the Strait of Gibraltar.', // May
    'Outside the migration and wintering windows, birding settles to a quieter baseline.', // Jun
    'Outside the migration and wintering windows, birding settles to a quieter baseline.', // Jul
    'Autumn raptor migration is building across the Strait of Gibraltar.', // Aug
    'Peak autumn raptor migration — huge numbers cross the Strait of Gibraltar between Europe and Africa.', // Sep
    'Autumn raptor migration continues in strong numbers across the Strait.', // Oct
    'Outside the migration and wintering windows, birding settles to a quieter baseline.', // Nov
    'Doñana\'s wintering waterfowl are arriving in strong numbers.', // Dec
  ],
  provence: [
    'Outside the Camargue breeding season, birding settles to a quieter baseline.', // Jan
    'Outside the Camargue breeding season, birding settles to a quieter baseline.', // Feb
    'Outside the Camargue breeding season, birding settles to a quieter baseline.', // Mar
    'The Camargue\'s flamingo and heron breeding season is beginning.', // Apr
    'The Camargue\'s flamingo and heron breeding season is building toward its peak.', // May
    'Peak Camargue breeding season — flamingos, herons, and egrets are at their most active.', // Jun
    'The Camargue breeding season continues at a strong level.', // Jul
    'Outside the Camargue breeding season, birding settles to a quieter baseline.', // Aug
    'Outside the Camargue breeding season, birding settles to a quieter baseline.', // Sep
    'Outside the Camargue breeding season, birding settles to a quieter baseline.', // Oct
    'Outside the Camargue breeding season, birding settles to a quieter baseline.', // Nov
    'Outside the Camargue breeding season, birding settles to a quieter baseline.', // Dec
  ],
  sicily: [
    'Outside the spring migration window, birding settles to a quieter baseline.', // Jan
    'Outside the spring migration window, birding settles to a quieter baseline.', // Feb
    'Outside the spring migration window, birding settles to a quieter baseline.', // Mar
    'Spring raptor migration across the Strait of Messina is building.', // Apr
    'Peak spring raptor migration — honey buzzards and other raptors cross the Strait of Messina heading north.', // May
    'Outside the spring migration window, birding settles to a quieter baseline.', // Jun
    'Outside the spring migration window, birding settles to a quieter baseline.', // Jul
    'Outside the spring migration window, birding settles to a quieter baseline.', // Aug
    'Outside the spring migration window, birding settles to a quieter baseline.', // Sep
    'Outside the spring migration window, birding settles to a quieter baseline.', // Oct
    'Outside the spring migration window, birding settles to a quieter baseline.', // Nov
    'Outside the spring migration window, birding settles to a quieter baseline.', // Dec
  ],
  'rajasthan-golden-triangle': [
    'Dry-season conditions bring wintering waterfowl to Keoladeo Ghat in strong numbers.', // Jan
    'Dry-season conditions bring wintering waterfowl to Keoladeo Ghat in strong numbers.', // Feb
    'Waterfowl numbers are easing as the dry season progresses toward the pre-monsoon heat.', // Mar
    'Rising heat limits comfortable access to the wetland.', // Apr
    'Rising heat limits comfortable access to the wetland.', // May
    'Pre-monsoon heat continues to limit conditions at the wetland.', // Jun
    'Monsoon rains bring relief from the heat, though water levels are still building.', // Jul
    'Monsoon conditions continue across the wetland.', // Aug
    'Post-monsoon conditions are settling as water levels stabilize.', // Sep
    'Conditions are improving as the dry season approaches.', // Oct
    'Wintering waterfowl are arriving at Keoladeo Ghat in strong numbers.', // Nov
    'Dry-season conditions bring wintering waterfowl to Keoladeo Ghat in strong numbers.', // Dec
  ],
};

const FLAT_TEXT: Record<string, string> = {
  bordeaux: 'Common French countryside species in the vineyard landscape; nothing tied to a specific seasonal spectacle.',
  napa: 'Common Californian countryside species in the vineyard landscape; nothing tied to a specific seasonal spectacle.',
  puglia: 'Common Mediterranean countryside species; nothing tied to a specific seasonal spectacle.',
  sardinia: 'Salt pans near Cagliari hold a real flamingo colony, alongside common Mediterranean island species elsewhere.',
  amalfi: 'Common Mediterranean coastal species; nothing tied to a specific seasonal spectacle.',
  'nice-riviera': 'Common Mediterranean coastal species; nothing tied to a specific seasonal spectacle.',
  croatia: 'Common Adriatic coastal species; nothing tied to a specific seasonal spectacle.',
  santorini: 'Common Aegean island species; nothing tied to a specific seasonal spectacle.',
  mallorca: 'S\'Albufera wetland reserve is a genuine birding site, holding species uncommon elsewhere in the Mediterranean.',
  canaries: 'Laurel forest endemics — including several species found nowhere else — are present on the western islands.',
  madeira: 'Zino\'s petrel, one of the rarest seabirds in the world, breeds only on Madeira\'s highest peaks, alongside other laurel-forest endemics.',
  azores: 'The islands are well known among birders for autumn vagrant landbirds blown across the Atlantic from North America, alongside resident seabird colonies.',
  'st-andrews-fife': 'The Isle of May nearby holds one of the UK\'s largest seabird colonies, including puffins and gannets, though the mainland coast itself offers a common baseline.',
  'basque-country': 'Common Bay of Biscay coastal species, with a modest raptor passage along the coast; nothing tied to a specific seasonal spectacle.',
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

  async function writeBlurb(id: string, overview: string, monthly: string[]) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    if (monthly.length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: overview },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: monthly },
    };
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

  for (const [id, overview] of Object.entries(OVERVIEWS)) {
    await writeBlurb(id, overview, MONTHLY[id]);
  }
  for (const [id, text] of Object.entries(FLAT_TEXT)) {
    await writeBlurb(id, text, Array(12).fill(text));
  }

  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
