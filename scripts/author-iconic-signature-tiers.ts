import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';
import { toScoringPlace } from '../src/lib/db/queries/places';
import { fitDestinationCurves } from '../src/lib/scoring/fitCurve';

/**
 * Hand-authored signatureTier for the six ICONIC-tier interests — the ones
 * carrying audience weight 1.0, where the gap between "notable for this"
 * and "has some of this" swings a destination's rank hardest.
 *
 * These override the percentile derivation, which can only ask "is this
 * score high among destinations authored for this interest" and therefore
 * cannot tell a reason-to-visit from a pleasant bonus. Maui scores 8 for
 * nationalParks and the derivation calls that strong; Haleakalā is real,
 * but nobody picks Maui for a national park — they pick it for the coast.
 * Same shape as Tayrona putting Colombian Caribbean second overall.
 *
 * Only disagreements are listed. Where the derivation already gets it
 * right, nothing is written — an authored tier is an editorial claim and
 * should exist only where a human actually made one.
 *
 * The test applied to every entry: WOULD SOMEONE CHOOSE THIS DESTINATION
 * FOR THIS THING? Not "is it good", not "is it present" — is it a reason.
 */

type Tier = 'signature' | 'strong' | 'casual' | 'none';
const T: Record<string, Record<string, Tier>> = {
  scenicLandscapes: {
    // The landscape IS the destination — derivation had these at strong
    // because an 8 is merely above the 75th percentile.
    'lake-district': 'signature', lofoten: 'signature', grandcanyon: 'signature',
    'rocky-mountain': 'signature', iceland: 'signature', banff: 'signature',
    amalfi: 'signature', borabora: 'signature', antarctica: 'signature',
    santorini: 'signature', // the caldera view is the entire reason people go
    // Scenery is real but not the draw: people come for wildlife, diving,
    // beaches, skiing or food, and the landscape is what it happens to sit in.
    'colombian-caribbean': 'casual', gbr: 'casual', komodo: 'casual', galapagos: 'casual',
    kenya: 'casual', sicily: 'casual', whistler: 'casual', sardinia: 'casual',
    srilanka: 'casual', canaries: 'casual', mallorca: 'casual', falklands: 'casual',
    tanzania: 'casual', kruger: 'casual', botswana: 'casual', zambia: 'casual',
    // Genuinely scenic but multi-draw — one reason among several.
    'douro-valley-porto': 'strong', 'cape-town': 'strong', ethiopia: 'strong',
    'north-island': 'strong', 'tierra-del-fuego': 'strong', uluru: 'strong',
    croatia: 'strong', yellowstone: 'strong', lapland: 'strong', 'costa-rica': 'strong',
    belize: 'strong',
  },

  nationalParks: {
    // The US set (the non-US catalogue was notched separately). A park is
    // only signature where the park IS the destination.
    'bend-crater-lake': 'signature',
    'big-island': 'strong', 'southeast-alaska': 'strong',
    maui: 'casual', // Haleakalā is real; the coast is why people come
    'upper-peninsula': 'casual', 'monterey-big-sur': 'casual', everglades: 'casual',
    sedona: 'none', aspen: 'none', vermont: 'none',
  },

  beachesSwimming: {
    // Beach IS the trip — derivation put these at strong for sitting a
    // fraction under the signature cutoff.
    aruba: 'signature', 'punta-cana': 'signature', thailand: 'signature',
    sardinia: 'signature', mallorca: 'signature', croatia: 'signature',
    algarve: 'signature', canaries: 'signature',
    // Coastline exists and is enjoyed, but it is not the reason.
    gbr: 'casual', galapagos: 'casual', egypt: 'casual', tanzania: 'casual',
    sydney: 'casual', santorini: 'casual', havana: 'casual', 'cape-town': 'casual',
    komodo: 'casual', rajaampat: 'casual', // diving destinations, not beach ones
    'texas-hill-country': 'none', hongkong: 'none', singapore: 'none',
  },

  streetFood: {
    // Food is a headline reason to pick the place.
    'new-orleans': 'signature', oaxaca: 'signature', 'basque-country': 'signature',
    // Perfectly good eating, not a draw in its own right.
    dubai: 'casual', jordan: 'casual', 'bend-crater-lake': 'casual',
    'st-andrews-fife': 'casual', 'texas-hill-country': 'casual',
    'cape-cod-islands': 'casual', 'los-cabos': 'casual', 'hudson-valley': 'casual',
    champagne: 'casual', napa: 'casual',
  },

  historyArchaeology: {
    havana: 'strong', // Old Havana is the destination
    belize: 'strong', zimbabwe: 'strong', // Maya sites; Great Zimbabwe
    'cape-town': 'casual', copenhagen: 'casual', 'bavaria-munich': 'casual',
    bangkok: 'casual', 'colombian-caribbean': 'casual',
    grandcanyon: 'none', 'big-island': 'none', sydney: 'none', dubai: 'none',
  },

  cityExploration: {
    andalucia: 'strong', // Seville, Granada, Córdoba
    'rajasthan-golden-triangle': 'strong', vietnam: 'strong', peru: 'strong',
    piedmont: 'strong', // Turin
    maui: 'none', 'big-island': 'none', queenstown: 'none', aspen: 'none',
    whistler: 'none', canaries: 'none', algarve: 'none',
  },
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
