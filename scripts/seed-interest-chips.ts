// First chips for the interests Gemini has authored (17 Oct 2026), from the simplified Chips-tab mockup. Skips any interest that already has
// chips, so it is safe to run twice. Every driver is checked against the real columns before anything is written.
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-interest-chips.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';

for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
}

interface Seed { key: string; label: string; live: boolean; drivers: Array<{ column: string; option?: string; fullAt?: number }>; needsColumn?: string }
const SEEDS: Record<string, Seed[]> = {
  hiking: [
    { key: 'easy-walks', label: 'Easy walks', live: true, drivers: [{ column: 'ways', option: 'easyWalks' }] },
    { key: 'day-hikes', label: 'Day hikes', live: true, drivers: [{ column: 'dayHikeRating' }] },
    { key: 'multi-day-treks', label: 'Multi-day treks', live: true, drivers: [{ column: 'trekRating' }] },
    { key: 'hut-to-hut', label: 'Hut-to-hut', live: true, drivers: [{ column: 'ways', option: 'hutTreks' }] },
    { key: 'walk-up-summits', label: 'Walk-up summits', live: false, drivers: [{ column: 'ways', option: 'summits' }] },
  ],
  birding: [
    { key: 'endemic-species', label: 'Endemic species', live: true, drivers: [{ column: 'endemicSpecies', fullAt: 40 }, { column: 'endemicFamilies', fullAt: 2 }] },
    { key: 'rare-birds-and-lifers', label: 'Rare birds and lifers', live: true, drivers: [{ column: 'species', fullAt: 1200 }] },
    { key: 'easy-close-up-birding', label: 'Easy, close-up birding', live: true, drivers: [{ column: 'viewsPhoto' }] },
    { key: 'colonies-and-migrations', label: 'Colonies and migrations', live: true, drivers: [{ column: 'spectacle' }] },
    { key: 'seabirds', label: 'Seabirds', live: false, drivers: [], needsColumn: 'Bird groups (pick any of seabirds and colonies, raptors, waterbirds and waders, parrots and tropical birds, owls)' },
  ],
  safari: [
    { key: 'big-cats', label: 'Big cats', live: true, drivers: [{ column: 'lion' }, { column: 'leopard' }, { column: 'cheetah' }, { column: 'tiger' }] },
    { key: 'great-migration', label: 'Great migration', live: true, drivers: [{ column: 'herds' }, { column: 'spectacle' }] },
    { key: 'walking-safaris', label: 'Walking safaris', live: true, drivers: [{ column: 'walking', option: 'yes' }] },
    { key: 'self-drive', label: 'Self-drive', live: true, drivers: [{ column: 'selfDrive', option: 'yes' }] },
    { key: 'boat-and-canoe-safaris', label: 'Boat and canoe safaris', live: true, drivers: [{ column: 'boat', option: 'yes' }] },
    { key: 'wild-dogs', label: 'Wild dogs', live: false, drivers: [{ column: 'wildDog' }] },
  ],
  diving: [
    { key: 'colorful-reefs', label: 'Colorful reefs', live: true, drivers: [{ column: 'drawType', option: 'reef' }] },
    { key: 'wrecks', label: 'Wrecks', live: true, drivers: [{ column: 'drawType', option: 'wrecks' }] },
    { key: 'caves-and-cenotes', label: 'Caves and cenotes', live: true, drivers: [{ column: 'drawType', option: 'caves' }] },
    { key: 'big-animals', label: 'Big animals', live: true, drivers: [{ column: 'drawType', option: 'animals' }] },
    { key: 'snorkeling-friendly', label: 'Snorkeling-friendly', live: true, drivers: [{ column: 'snorkelingRating' }] },
    { key: 'liveaboards', label: 'Liveaboards', live: false, drivers: [{ column: 'accessStyle', option: 'liveaboard' }] },
  ],
  whaleWatching: [
    { key: 'humpbacks', label: 'Humpbacks', live: true, drivers: [{ column: 'humpback' }] },
    { key: 'orcas', label: 'Orcas', live: true, drivers: [{ column: 'orca' }] },
    { key: 'blue-and-fin-whales', label: 'Blue and fin whales', live: true, drivers: [{ column: 'blue' }, { column: 'fin' }] },
    { key: 'dolphins-and-porpoises', label: 'Dolphins and porpoises', live: true, drivers: [{ column: 'dolphins' }] },
    { key: 'swim-with-whales', label: 'Swim with whales', live: true, drivers: [{ column: 'swimAllowed' }] },
    { key: 'from-shore', label: 'From shore', live: false, drivers: [{ column: 'watchShore' }] },
  ],
  surfing: [
    { key: 'learn-to-surf', label: 'Learn to surf', live: true, drivers: [{ column: 'beginnerRating' }] },
    { key: 'big-powerful-waves', label: 'Big, powerful waves', live: true, drivers: [{ column: 'advancedRating' }] },
    { key: 'point-breaks', label: 'Point breaks', live: true, drivers: [{ column: 'waveType', option: 'point' }] },
    { key: 'uncrowded-waves', label: 'Uncrowded waves', live: true, drivers: [{ column: 'crowds', option: 'quiet' }] },
    { key: 'longboard-friendly', label: 'Longboard-friendly', live: true, drivers: [{ column: 'boards', option: 'longboard' }] },
    { key: 'remote-surf-trips', label: 'Remote surf trips', live: false, drivers: [{ column: 'access', option: 'remote' }] },
  ],
  wildlifeViewing: [
    { key: 'big-predators', label: 'Big predators', live: true, drivers: [{ column: 'predators' }] },
    { key: 'large-herbivores', label: 'Large herbivores', live: true, drivers: [{ column: 'herbivores' }] },
    { key: 'primates', label: 'Primates', live: true, drivers: [{ column: 'primates' }] },
    { key: 'marine-life', label: 'Marine life', live: true, drivers: [{ column: 'marineLife' }] },
    { key: 'reptiles-and-amphibians', label: 'Reptiles and amphibians', live: true, drivers: [{ column: 'herps' }] },
    { key: 'easy-close-up-viewing', label: 'Easy, close-up viewing', live: false, drivers: [{ column: 'closeUp' }] },
  ],
};

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestChips } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { factDefsFor } = await import('../src/lib/admin/interest-pages/config');
  const { driverProblem, MAX_LIVE_CHIPS } = await import('../src/lib/admin/interest-pages/chips');
  for (const [interestKey, seeds] of Object.entries(SEEDS)) {
    const defs = factDefsFor(interestKey);
    const problems = seeds.flatMap((s) => s.drivers.map((d) => driverProblem(d, defs)).filter(Boolean).map((p) => `${s.label}: ${p}`));
    if (problems.length) throw new Error(`${interestKey}: ${problems.join('; ')}`);
    if (seeds.filter((s) => s.live).length > MAX_LIVE_CHIPS) throw new Error(`${interestKey}: more than ${MAX_LIVE_CHIPS} live`);
    const existing = await db.select().from(interestChips).where(eq(interestChips.interestKey, interestKey));
    if (existing.length) { console.log(`${interestKey}: already has ${existing.length} chips, skipped`); continue; }
    if (apply) await db.insert(interestChips).values(seeds.map((s, i) => ({ interestKey, chipKey: s.key, label: s.label, sortOrder: i + 1, status: s.live ? ('live' as const) : ('draft' as const), drivers: s.drivers, needsColumn: s.needsColumn ?? '', updatedBy: 'Claude (first set, 17 Oct 2026)' })));
    console.log(`${interestKey}: ${apply ? 'wrote' : 'would write'} ${seeds.length} chips (${seeds.filter((s) => s.live).length} live)`);
  }
  process.exit(0);
})();
