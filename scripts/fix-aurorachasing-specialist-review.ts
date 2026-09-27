import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Playbook §1 Step 5 (specialist-lens review), done after the fact for
 * auroraChasing. Tiers all held up against real sources (Churchill/Iceland/
 * Lapland/Lofoten/Svalbard apex, Fairbanks/Denali just under, Tasmania >
 * Falklands > Milford Sound & Fiordland). Content fixes, no score changes:
 *
 * - milford-sound-fiordland: the overview implicitly borrowed its "how easy
 *   is this" framing from Stewart Island research (a genuinely different,
 *   better-suited island — open southern horizon, official Dark Sky
 *   Sanctuary). Milford Sound itself sits in a fjord ringed by mountains
 *   that block the southern horizon the aurora needs, plus ~7m/year of
 *   rain — a real difficulty the old text glossed over. Verified:
 *   fiordland.org.nz, qantas.com/travelinsider.
 * - glacier-waterton: names the real, verified designation (Waterton-Glacier
 *   is the world's first international transboundary Dark Sky Park, 2017)
 *   and Lake McDonald, a real documented aurora-photo site there.
 * - vermont: names the real viewing corridor (Stowe / Smugglers' Notch-Jay
 *   Peak, Green Mountains) instead of generic "elevation and a dark rural
 *   sky."
 * - southeast-alaska: never actually named Juneau despite being researched
 *   around it — added.
 */
const KEY = 'auroraChasing';

const OVERVIEWS: Record<string, string> = {
  'milford-sound-fiordland': "Fiordland is a real, if difficult, spot for the aurora australis — its steep, mountain-walled fjords block much of the southern horizon the display needs, and the region gets roughly 7 meters of rain a year on top of that. A clear, unobstructed view here is a genuine event, not a given.",
  'glacier-waterton': "Waterton-Glacier is the world's first international dark-sky park spanning a border, certified in 2017 — genuinely dark skies on both the US and Canadian sides. Aurora here (photographed over Lake McDonald, among other spots) still needs a real geomagnetic storm; the dark-sky certification is about sky quality, not aurora frequency.",
  vermont: "Vermont gets the aurora only during a real geomagnetic storm — Stowe and the stretch of Green Mountains between Smugglers' Notch and Jay Peak have the state's darkest, most elevated skies, but this is an occasional bonus on a clear night, not a plannable season.",
  'southeast-alaska': "Aurora around Juneau is real but genuinely modest — regular through the dark season, needing a moderately active night to clear the area's frequent cloud cover, and effectively invisible in summer's near-constant light.",
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
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  for (const id of Object.keys(OVERVIEWS)) {
    const [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }
    const patch = { sliderOverview: { ...(row.sliderOverview as Record<string, string>), [KEY]: OVERVIEWS[id] } };
    if (!dryRun) {
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...patch, updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({ actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id, action: 'update', beforeValue: row, afterValue: after });
      });
    }
    console.log(`  ${id}`);
  }
  console.log(dryRun ? '\ndry run — nothing written.' : '\ndone.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
