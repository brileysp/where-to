import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

const KEY = 'wildlifeViewing';

const OVERVIEWS: Record<string, string> = {
  churchill: 'Churchill is the world\'s best place for ground-level polar bear encounters — bears gather along the coast each fall waiting for Hudson Bay to freeze, and tundra buggy tours in late October and November see them close to daily. Outside that window, bears are essentially absent near town. Thousands of beluga whales gather in the river estuary each summer, a lesser but real reason to visit outside bear season.',
  antarctica: 'Antarctica\'s penguin colonies — chinstrap, gentoo, and Adélie depending on where you land — are the visual centerpiece of any landing, joined by crabeater, Weddell, and the more predatory leopard seal hauled out on the ice. Only reachable by ship from November through March.',
  svalbard: 'Polar bears are the reason most people come, and Svalbard offers some of the best realistic odds anywhere for the species on a multi-day expedition cruise along the sea ice edge — though sightings are still genuinely a matter of luck, never guaranteed. Walrus haul-outs are a far more reliable sighting on the same trips.',
  iceland: 'Iceland\'s only native land mammal, the Arctic fox, is a real but genuinely elusive sighting — the Westfjords\' Hornstrandir Nature Reserve is the best-known spot. Wildlife-watching here is a secondary draw at best.',
  falklands: 'Southern sea lions and one of the world\'s largest elephant seal colonies are the real draw at Sea Lion Island — genuinely reliable sightings at the height of the breeding season. Penguins, five species in total, are common here too.',
  greenland: 'Musk ox are surprisingly easy to find on a day trip from Kangerlussuaq — a real, fairly reliable sighting despite Greenland not otherwise being a dedicated wildlife destination. Arctic fox are also present but a much more opportunistic, luck-based sighting.',
};

const CHURCHILL_OFF = 'Bears have moved out onto the sea ice to hunt; none are near town.';
const CHURCHILL_BELUGA = 'Beluga whales gather in the river estuary in large numbers; polar bears remain out on the ice.';
const CHURCHILL_GATHERING = 'Bears are starting to gather along the coast as they wait for the bay to freeze.';
const CHURCHILL_PEAK = 'Peak season — bears concentrate along the coast waiting for the ice, and tundra buggy tours see them close to daily.';
const CHURCHILL_FREEZING = 'The bay is freezing over and bears are dispersing back onto the ice.';

const ANTARCTICA_PEAK = 'Peak season — chicks are hatching and seals are commonly seen hauled out on the ice.';
const ANTARCTICA_CLOSED = 'Antarctica is inaccessible; no ships sail this route.';

const SVALBARD_NIGHT = 'Svalbard is in polar night; wildlife cruises don\'t run.';
const SVALBARD_RETURNING = 'Light is returning but sea ice still limits cruise access; sightings are more limited.';
const SVALBARD_BEAR_PEAK = 'Peak polar bear season — expedition cruises work the sea ice edge for the best odds of the year, though a sighting is still a matter of luck. Walrus haul-outs are a more reliable sighting on the same trips.';
const SVALBARD_WALRUS = 'The open-water season — walrus haul-outs remain a reliable sighting; polar bear odds ease slightly as the ice retreats further north.';
const SVALBARD_WINDING_DOWN = 'Sea ice is beginning to reform and light is fading; cruise options narrow toward the end of the season.';

const ICELAND_BASELINE = 'A genuinely elusive sighting year-round; the Westfjords remain the best-known spot to try.';
const ICELAND_SUMMER = 'Summer access to the Westfjords improves the odds slightly, though sightings remain a matter of luck.';

const FALKLANDS_BREEDING = 'Peak breeding season — sea lions and elephant seals are at their most active, males fighting for territory and pups being born.';
const FALKLANDS_PUPS = 'Elephant seal pups are venturing into the sea for the first time; sea lions remain very active.';
const FALKLANDS_EASING = 'Still strong odds, though the breeding season is easing.';
const FALKLANDS_WINDING_DOWN = 'Breeding activity is winding down.';
const FALKLANDS_BASELINE = 'A quieter baseline; sea lions and elephant seals remain present in smaller numbers.';

const GREENLAND_TEXT = 'Musk ox remain a fairly reliable sighting on a day trip from Kangerlussuaq year-round; Arctic fox sightings stay a matter of luck.';

const MONTHLY: Record<string, string[]> = {
  churchill: [
    CHURCHILL_OFF, CHURCHILL_OFF, CHURCHILL_OFF, CHURCHILL_OFF, CHURCHILL_OFF, CHURCHILL_OFF,
    CHURCHILL_BELUGA, CHURCHILL_BELUGA,
    CHURCHILL_GATHERING,
    CHURCHILL_PEAK, CHURCHILL_PEAK,
    CHURCHILL_FREEZING,
  ],
  antarctica: [
    ANTARCTICA_PEAK, ANTARCTICA_PEAK, ANTARCTICA_PEAK,
    ANTARCTICA_CLOSED, ANTARCTICA_CLOSED, ANTARCTICA_CLOSED, ANTARCTICA_CLOSED, ANTARCTICA_CLOSED, ANTARCTICA_CLOSED, ANTARCTICA_CLOSED,
    'The season is opening; landings begin as the ice retreats and penguin chicks start hatching.',
    ANTARCTICA_PEAK,
  ],
  svalbard: [
    SVALBARD_NIGHT,
    SVALBARD_RETURNING, SVALBARD_RETURNING,
    SVALBARD_BEAR_PEAK, SVALBARD_BEAR_PEAK, SVALBARD_BEAR_PEAK,
    SVALBARD_WALRUS, SVALBARD_WALRUS, SVALBARD_WALRUS,
    SVALBARD_WINDING_DOWN, SVALBARD_WINDING_DOWN,
    SVALBARD_NIGHT,
  ],
  iceland: [
    ICELAND_BASELINE, ICELAND_BASELINE, ICELAND_BASELINE, ICELAND_BASELINE, ICELAND_BASELINE,
    ICELAND_SUMMER, ICELAND_SUMMER, ICELAND_SUMMER,
    ICELAND_BASELINE, ICELAND_BASELINE, ICELAND_BASELINE, ICELAND_BASELINE,
  ],
  falklands: [
    FALKLANDS_PUPS, FALKLANDS_EASING,
    FALKLANDS_WINDING_DOWN,
    FALKLANDS_BASELINE, FALKLANDS_BASELINE, FALKLANDS_BASELINE, FALKLANDS_BASELINE, FALKLANDS_BASELINE, FALKLANDS_BASELINE,
    FALKLANDS_EASING,
    FALKLANDS_BREEDING, FALKLANDS_BREEDING,
  ],
  greenland: Array(12).fill(GREENLAND_TEXT),
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
  if (!env.DATABASE_URL) { console.error('No DATABASE_URL'); process.exit(1); }
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12`); process.exit(1); }
    const patch: Record<string, unknown> = {
      sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] },
      sliderMonthlyWeather: { ...(row.sliderMonthlyWeather as Record<string, (string | null)[]>), [KEY]: MONTHLY[id] },
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
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
