import { readFileSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { places, adminAuditLog } from '../src/lib/db/schema';

/**
 * Comprehensive final pass: applies scripts/audit-birding-model.ts's
 * precise target peak to all 107 destinations it can model (species
 * count + endemism + charisma + spectacle), superseding the earlier
 * rougher "dial back to 9" fix for mechanism-artifact destinations —
 * turns out none of those were exactly 9 once measured precisely
 * (Tierra del Fuego's real target is 4, Antarctica's is 5, Everglades' is
 * 8, not the flat 9 first guessed).
 *
 * Non-anchor destinations are capped at 9 even where the model rounds to
 * 10 (Panama at 9.6, for instance) — reaching the true ceiling requires
 * real authored content behind it, not just a strong model estimate; that
 * stays a candidate for a future dedicated authoring pass, the same
 * discipline used for every anchor decision this session.
 *
 * Correction mechanism is chosen per-destination from its current state:
 *   - Real sliderEvents.birding exists -> scale event weight(s) so peak
 *     hits target (uniform scale factor across all events if more than
 *     one, preserving their relative balance).
 *   - No events but birdingPeak flagged -> base = target - 3 (matching
 *     the fixed fallback bonus).
 *   - Neither -> base = target flat.
 */

const KEY = 'birding';
const ANCHORS = new Set([
  'colombian-andes', 'peru', 'ecuadorian-andes', 'costa-rica', 'peruvian-amazon',
  'papua-new-guinea', 'madagascar', 'kenya', 'pantanal', 'uganda', 'tanzania', 'ethiopia',
]);

// Stale sliderCaps.birding entries (leftover patches for the old +7
// fallback bug) that would otherwise clamp the correct target below what
// it should be — same pattern already found and removed on uyuni/
// canaries/yellowstone/morocco.
const REMOVE_STALE_CAP = new Set(['cape-town', 'vietnam', 'rajasthan-golden-triangle', 'egypt']);

// Real event, target < current base — the generic uniform-scale formula
// below would turn a genuinely positive seasonal highlight (puffin
// nesting) into a nonsensical negative-weight event. Handled explicitly:
// lower the base and keep a modest, still-positive event weight, the same
// target<base pattern used repeatedly earlier this session (Lapland,
// Milford Sound, Everglades' kayakingRafting, etc).
const EXPLICIT_OVERRIDE: Record<string, { newBase: number; newWeight: number }> = {
  'faroe-islands': { newBase: 2, newWeight: 2 },
};

// id -> raw model score (pre-cap). Ties directly to audit-birding-model.ts's own output.
const MODEL: Record<string, number> = {
  'ecuadorian-andes': 10.0, 'colombian-andes': 10.0, peru: 9.9, 'peruvian-amazon': 9.6,
  'costa-rica': 9.1, pantanal: 8.8, kenya: 10.0, tanzania: 10.0, uganda: 10.0,
  ethiopia: 9.1, madagascar: 9.8, 'papua-new-guinea': 10.0,
  panama: 9.6, 'colombian-caribbean': 8.3, chiapas: 7.7, galapagos: 7.6, rwanda: 8.6,
  ghana: 8.7, botswana: 8.5, namibia: 8.0, borneo: 9.0, srilanka: 8.4, bhutan: 8.7,
  taiwan: 8.5, kaziranga: 7.6, hokkaido: 7.9, rajaampat: 8.0, everglades: 7.6,
  guatemala: 7.8, oaxaca: 7.7, kruger: 7.4, zimbabwe: 7.9, 'cape-town': 8.7,
  nepal: 7.8, kerala: 7.5, morocco: 7.6, 'north-island': 8.1, 'milford-sound-fiordland': 7.7,
  zambia: 8.2, vietnam: 8.0, 'rajasthan-golden-triangle': 7.7, iceland: 5.7, algarve: 6.5,
  churchill: 6.5, 'monterey-big-sur': 6.5, 'new-orleans': 6.2, 'texas-hill-country': 6.5,
  sydney: 7.2, bali: 5.9, yellowstone: 5.5, uyuni: 4.9, thailand: 5.0, egypt: 6.2,
  svalbard: 3.9, madeira: 3.5, canaries: 4.4, azores: 2.9, maldives: 3.2,
  'faroe-islands': 3.5, 'tierra-del-fuego': 4.4, 'torres-del-paine': 4.7, komodo: 4.9,
  atacama: 5.2, 'el-chalten': 4.3, antarctica: 5.4, bagan: 4.6, mauritius: 4.6,
  barbados: 4.6, banff: 4.6, yosemite: 4.6, 'glacier-waterton': 4.7, mendoza: 4.7,
  singapore: 5.8, olympic: 4.8, 'vancouver-island': 5.9, 'great-smoky-mountains': 4.9,
  acadia: 4.9, 'southeast-alaska': 6.0, 'badlands-black-hills': 5.0, 'nova-scotia': 5.0,
  'upper-peninsula': 5.0, fiji: 5.1, falklands: 6.1, dubai: 5.1, luangprabang: 5.2,
  'denali-interior': 4.3, 'argentine-lake-district': 5.4, 'chilean-lake-district': 5.4,
  uluru: 5.4, seychelles: 5.6, bangkok: 5.7, 'scottish-highlands-skye': 5.7, mallorca: 5.7,
  hongkong: 6.8, mexicocity: 5.8, jordan: 5.9, ladakh: 5.9, nicaragua: 7.0, palawan: 7.0,
  tasmania: 7.1, belize: 7.1, gbr: 6.2, angkor: 6.3, queenstown: 6.4, 'puerto-rico': 6.4,
  lofoten: 4.4, mongolia: 6.4,
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
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { toScoringPlace } = await import('../src/lib/db/queries/places');
  const { deriveDestinationScores, isSliderNA } = await import('../src/lib/scoring/destinations');
  const { fitMonthlyToCurve } = await import('../src/lib/scoring/fitCurve');
  const dryRun = process.argv.includes('--dry-run');
  const db = drizzlePostgres(postgres(env.DATABASE_URL, { prepare: false }));

  let changed = 0, skipped = 0;
  for (const [id, rawModel] of Object.entries(MODEL)) {
    let [row] = await db.select().from(places).where(eq(places.id, id));
    if (!row) { console.error(`${id}: not found`); process.exit(1); }

    if (REMOVE_STALE_CAP.has(id)) {
      const caps = { ...(row.sliderCaps as Record<string, unknown>) };
      delete caps[KEY];
      row = { ...row, sliderCaps: caps } as typeof row;
    }

    const scoring = toScoringPlace(row);
    if (isSliderNA(scoring, KEY)) { console.error(`${id}: is N/A`); process.exit(1); }

    const target = Math.min(Math.round(rawModel), ANCHORS.has(id) ? 10 : 9);
    const currentBase = scoring.base[KEY];
    const existingEvents = scoring.sliderEvents?.[KEY];
    const hasBirdingPeakFlag = Array.isArray(scoring.birdingPeak) && scoring.birdingPeak.length > 0;

    const { monthly: currentMonthly } = deriveDestinationScores(scoring, { skipHazards: true });
    const before = Math.max(...currentMonthly[KEY]);

    const patch: Record<string, unknown> = {};
    if (REMOVE_STALE_CAP.has(id)) patch.sliderCaps = row.sliderCaps;
    let newBase = currentBase;
    let newEvents = existingEvents;

    if (EXPLICIT_OVERRIDE[id]) {
      const o = EXPLICIT_OVERRIDE[id];
      newBase = o.newBase;
      newEvents = existingEvents!.map((e) => ({ ...e, weight: o.newWeight }));
      patch.baseScores = { ...(row.baseScores as Record<string, unknown>), [KEY]: newBase };
      patch.sliderEvents = { ...(scoring.sliderEvents ?? {}), [KEY]: newEvents };
    } else if (existingEvents && existingEvents.length > 0) {
      // Scale weight(s) uniformly so the strongest event's full-weight month hits target.
      const maxWeight = Math.max(...existingEvents.map((e) => e.weight));
      const neededBonus = target - currentBase;
      const scale = maxWeight !== 0 ? neededBonus / maxWeight : 0;
      newEvents = existingEvents.map((e) => ({ ...e, weight: Math.round(e.weight * scale * 10) / 10 }));
      patch.sliderEvents = { ...(scoring.sliderEvents ?? {}), [KEY]: newEvents };
    } else if (hasBirdingPeakFlag) {
      newBase = target - 3;
      patch.baseScores = { ...(row.baseScores as Record<string, unknown>), [KEY]: newBase };
    } else {
      newBase = target;
      patch.baseScores = { ...(row.baseScores as Record<string, unknown>), [KEY]: newBase };
    }

    const patchedScoring = toScoringPlace({ ...row, ...patch } as typeof row);
    const { monthly } = deriveDestinationScores(patchedScoring, { skipHazards: true });
    const actualPeak = Math.max(...monthly[KEY]);

    if (Math.abs(actualPeak - target) > 0.6) {
      console.log(`  WARN ${id.padEnd(24)} target=${target} but landed at ${actualPeak.toFixed(1)} — check manually`);
    }

    if (Math.abs(before - target) < 0.1 && Object.keys(patch).length === 0) { skipped++; continue; }

    console.log(`  ${id.padEnd(24)} model=${rawModel.toFixed(1)} target=${target}  peak ${before.toFixed(1)} -> ${actualPeak.toFixed(1)}`);

    if (!dryRun) {
      const fit = fitMonthlyToCurve(monthly[KEY], { maxSteepness: 4, errorTolerance: 0.5 });
      patch.sliderCurves = { ...(row.sliderCurves as Record<string, unknown>), [KEY]: fit.curve };
      patch.authoredCurves = Array.from(new Set([...(row.authoredCurves ?? []), KEY]));
      const after = { ...row, ...patch };
      await db.transaction(async (tx) => {
        await tx.update(places).set({ ...(patch as Partial<typeof places.$inferInsert>), updatedAt: new Date() }).where(eq(places.id, id));
        await tx.insert(adminAuditLog).values({
          actorId: '00000000-0000-0000-0000-000000000000', entityType: 'destination', entityId: id,
          action: 'update', beforeValue: row, afterValue: after,
        });
      });
    }
    changed++;
  }

  console.log(`\n${changed} destinations changed, ${skipped} already correct.`);
  console.log(dryRun ? 'dry run — nothing written.' : 'done.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
