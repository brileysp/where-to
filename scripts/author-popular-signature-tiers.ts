import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Hand-authored signatureTier for the POPULAR-tier interests (audience
 * weight 0.7), the second pass after the iconic six.
 *
 * Seven of these eleven had no tiers at all — wildlifeViewing, hiking,
 * museumsArt, architecture, sunbathing, nightlife and shopping, together
 * over a thousand authored scores running purely on percentile derivation.
 *
 * The recurring correction is the same one throughout: a big city scores
 * 7 for shopping or nightlife or architecture because those things are
 * genuinely there, and the derivation reads 7 as "above the 75th
 * percentile, therefore a draw." It isn't. Nobody flies to Rome to shop or
 * to Amsterdam for architecture — they arrive and find both. The test
 * stays: would someone choose this destination FOR this thing.
 *
 * Only disagreements with the derivation are written.
 */

type Tier = 'signature' | 'strong' | 'casual' | 'none';
const T: Record<string, Record<string, Tier>> = {
  wildlifeViewing: {
    // The animals ARE the destination.
    pantanal: 'signature', madagascar: 'signature', komodo: 'signature',
  },

  hiking: {
    'cape-town': 'strong', // Table Mountain is real, but not why you fly there
    provence: 'casual',
  },

  museumsArt: {
    luangprabang: 'strong',
    // Present and pleasant; not a reason to pick the place.
    'colombian-caribbean': 'casual', 'hudson-valley': 'casual', amalfi: 'casual',
    srilanka: 'casual', 'ecuadorian-andes': 'casual', 'colombian-andes': 'casual',
  },

  architecture: {
    // Handsome buildings, but nobody comes for the architecture.
    'cape-town': 'casual', sydney: 'casual', ghana: 'casual', nepal: 'casual',
    'hudson-valley': 'casual', rio: 'casual', bali: 'casual', vietnam: 'casual',
    nicaragua: 'casual', srilanka: 'casual', chiapas: 'casual', guatemala: 'casual',
    champagne: 'casual', 'douro-valley-porto': 'casual', puglia: 'casual',
  },

  sunbathing: {
    tanzania: 'strong', // Zanzibar earns it; the country's draw is safari
    santorini: 'strong', // people come for the caldera, not the tanning
    rio: 'strong',
    dubai: 'casual', havana: 'casual', srilanka: 'casual', komodo: 'casual',
  },

  nightlife: {
    'colombian-andes': 'casual', santorini: 'casual', rome: 'casual',
    croatia: 'casual', mallorca: 'casual', vietnam: 'casual', jamaica: 'casual',
    'cape-town': 'casual', athens: 'casual', 'bavaria-munich': 'casual',
  },

  shopping: {
    // A 7 for shopping in a great city means "there are shops", not
    // "come here to shop". Only the genuine shopping destinations keep it.
    venice: 'casual', egypt: 'casual', sydney: 'casual', 'nice-riviera': 'casual',
    santorini: 'casual', rome: 'casual', amsterdam: 'casual', bali: 'casual',
    beijing: 'casual', chicago: 'casual', copenhagen: 'casual', amalfi: 'casual',
    uzbekistan: 'casual', oaxaca: 'casual', 'san-miguel-guanajuato': 'casual',
    barcelona: 'casual', buenosaires: 'casual',
  },

  familyFun: {
    // Authored earlier in this session but never tiered. All are excellent
    // with children; none is chosen because it is family-friendly.
    paris: 'strong', london: 'strong', nyc: 'strong', chicago: 'strong',
    'lake-district': 'strong', 'bavaria-munich': 'strong',
  },

  allInclusive: { canaries: 'strong' },
  themeParks: { copenhagen: 'strong' },
};

function loadDotEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  let raw: string;
  try {
    raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
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

  const rows = await db.select().from(places).where(eq(places.isPrimaryDestination, true));
  const byId = new Map(rows.map((r) => [r.id, r]));

  const edits = new Map<string, Record<string, Tier>>();
  const problems: string[] = [];
  let count = 0;

  for (const [interest, picks] of Object.entries(T)) {
    for (const [id, tier] of Object.entries(picks)) {
      const row = byId.get(id);
      if (!row) { problems.push(`unknown destination: ${id} (${interest})`); continue; }
      const score = (row.baseScores as Record<string, number>)[interest];
      if (score === undefined || score === 0) {
        problems.push(`${id}/${interest}: no authored score — a tier would describe nothing`);
        continue;
      }
      if ((row.naSliders ?? []).includes(interest)) {
        problems.push(`${id}/${interest}: marked N/A — a tier contradicts that`);
        continue;
      }
      if (!edits.has(id)) edits.set(id, {});
      edits.get(id)![interest] = tier;
      count++;
    }
  }
  if (problems.length) {
    console.error('Validation failed:\n  ' + problems.join('\n  '));
    process.exit(1);
  }

  console.log(`\n${count} tier claims across ${edits.size} destinations`);
  if (dryRun) {
    for (const [id, e] of edits) console.log(`  ${id.padEnd(28)} ${Object.entries(e).map(([k, v]) => `${k}=${v}`).join(' ')}`);
    console.log('\ndry run — nothing written.');
    process.exit(0);
  }

  let written = 0;
  for (const [id, e] of edits) {
    const row = byId.get(id)!;
    const signatureTier = { ...(row.signatureTier as Record<string, Tier>), ...e };
    const after = { ...row, signatureTier };
    await db.transaction(async (tx) => {
      await tx.update(places).set({ signatureTier, updatedAt: new Date() }).where(eq(places.id, id));
      await tx.insert(adminAuditLog).values({
        actorId: '00000000-0000-0000-0000-000000000000',
        entityType: 'destination',
        entityId: id,
        action: 'update',
        beforeValue: row,
        afterValue: after,
      });
      const curves = fitDestinationCurves(toScoringPlace(after as Parameters<typeof toScoringPlace>[0]));
      await tx.update(places).set({ sliderCurves: curves }).where(eq(places.id, id));
    });
    written++;
  }
  console.log(`\ndone: ${written} destinations updated, ${count} tier claims authored.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
