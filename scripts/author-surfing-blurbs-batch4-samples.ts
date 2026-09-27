import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * The 4 original sample destinations (maui, lisbon, bali, aruba) shown to
 * the user at the start of the surfing authoring pass were never actually
 * written to the DB — batch1-3 all skipped them. Backfilling here, matching
 * the real base/event data already stored for maui/lisbon/bali, and the
 * genuinely modest, non-seasonal flat score already stored for aruba
 * (post windsurfing-conflation fix, base 3 → peak 4).
 */

const KEY = 'surfing';

const OVERVIEWS: Record<string, string> = {
  maui: 'Pe\'ahi ("Jaws"), on the north shore, is one of the most famous big-wave breaks in the world — a real professional tow-in and paddle venue when winter swell is at its biggest. The rest of the island stays genuinely good year-round: Honolua Bay picks up the same winter swell on a smaller scale, while south-shore spots near Kihei and Lahaina pick up summer\'s smaller south swell.',
  lisbon: 'Ericeira, a short drive up the coast, is Europe\'s first World Surfing Reserve — a string of quality reef and point breaks that work on multiple swell directions. Carcavelos, right in the city, and Costa da Caparica across the river are the convenient, easy options. Winter\'s Atlantic storm swell is the bigger, more serious season; those chasing the record-breaking giant waves at Nazaré, the famous big-wave venue about 90 minutes further north, come specifically for that same winter window.',
  bali: 'The Bukit Peninsula\'s Uluwatu, Padang Padang, and Bingin are legendary reef breaks and a real pilgrimage destination for experienced surfers worldwide. The dry season (roughly April-October) is genuinely the season: offshore trade winds groom the swell into the clean, powerful waves Bali is famous for. The wet season brings onshore wind that makes conditions messier, though the island\'s other coasts offer workable backup options.',
  aruba: 'Real, if modest, wave-surfing exists on the rougher, windward northeast coast at spots like Andicuri and Boca Grandi — distinct from Fisherman\'s Huts on the calm west side, which is genuinely one of the world\'s best windsurfing and kitesurfing spots, not a wave-surfing one. Conditions stay fairly flat and non-seasonal year-round; this isn\'t a serious surf trip destination.',
};

const MONTHLY: Record<string, string[]> = {
  maui: [
    'Winter north swell, including Jaws — the biggest, most serious surf of the year.',
    'Winter north swell, including Jaws — the biggest, most serious surf of the year.',
    'Winter north swell, including Jaws — the biggest, most serious surf of the year.',
    'Smaller, still-solid conditions as winter swell eases.',
    'Smaller, still-solid conditions; summer\'s south-shore swell begins.',
    'Summer south-shore swell, smaller and more forgiving than winter.',
    'Summer south-shore swell, smaller and more forgiving than winter.',
    'Summer south-shore swell, smaller and more forgiving than winter.',
    'Summer south-shore swell, smaller and more forgiving than winter.',
    'Conditions building back up as winter approaches.',
    'Winter north swell returns, including Jaws.',
    'Winter north swell, including Jaws — the biggest, most serious surf of the year.',
  ],
  lisbon: [
    'Winter Atlantic storm swell — the biggest waves of the year, including at Nazaré.',
    'Winter Atlantic storm swell — the biggest waves of the year, including at Nazaré.',
    'Winter Atlantic storm swell continues.',
    'Smaller, calmer spring conditions.',
    'Smaller, calmer spring conditions.',
    'Smaller, calmer summer conditions — easier and more beginner-friendly.',
    'Smaller, calmer summer conditions — easier and more beginner-friendly.',
    'Smaller, calmer summer conditions — easier and more beginner-friendly.',
    'Smaller, calmer conditions persist into early autumn.',
    'Swell building again as autumn storms arrive.',
    'Winter Atlantic storm swell returns, including at Nazaré.',
    'Winter Atlantic storm swell — the biggest waves of the year, including at Nazaré.',
  ],
  bali: [
    'Wet season — onshore wind makes conditions messier.',
    'Wet season — onshore wind makes conditions messier.',
    'Wet season — onshore wind makes conditions messier.',
    'Dry season begins — offshore trades groom the swell.',
    'Dry season — the Bukit\'s reef breaks at their best.',
    'Dry season — the Bukit\'s reef breaks at their best.',
    'Dry season — the Bukit\'s reef breaks at their best.',
    'Dry season — the Bukit\'s reef breaks at their best.',
    'Dry season — the Bukit\'s reef breaks at their best.',
    'Dry season winding down, still excellent.',
    'Wet season returns — onshore wind makes conditions messier.',
    'Wet season — onshore wind makes conditions messier.',
  ],
  aruba: Array(12).fill('Flat, non-seasonal conditions — a modest wave-surf option at best.'),
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
    if (MONTHLY[id].length !== 12) { console.error(`${id}: monthly array is not length 12 (${MONTHLY[id].length})`); process.exit(1); }
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
