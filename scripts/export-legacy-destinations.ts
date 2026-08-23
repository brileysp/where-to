import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { RAW_DESTINATIONS } from './legacy/data.js';
import { destinationSchema, formatValidationErrors, type DestinationContent } from './content/destination-schema';

/**
 * One-time migration off data.js: validates every legacy destination
 * through the same schema the ongoing importer uses, then writes one clean
 * JSON file per destination to content/destinations/. Omits empty/default
 * fields so a file only shows what's actually authored for that
 * destination — the importer's schema defaults restore them on read, so
 * this round-trips exactly.
 */

const OUT_DIR = join(__dirname, '..', 'content', 'destinations');

function prune(d: DestinationContent): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: d.id,
    name: d.name,
    region: d.region,
    emoji: d.emoji,
    climate: d.climate,
    about: d.about,
    base: d.base,
    budgetBands: d.budgetBands,
    vibeBands: d.vibeBands,
    physicalBands: d.physicalBands,
  };

  const monthFields = [
    'dry', 'wet', 'hot', 'cold', 'peak', 'low',
    'wildlifePeak', 'wildlifeClosed', 'birdingPeak',
    'hikingBest', 'hikingWorst', 'inaccessible', 'swimHazard', 'noSnow',
  ] as const;
  for (const key of monthFields) {
    if (d[key].length > 0) out[key] = d[key];
  }

  if (d.peakIntensity !== null) out.peakIntensity = d.peakIntensity;
  if (Object.keys(d.sliderCaps).length > 0) out.sliderCaps = d.sliderCaps;
  if (Object.keys(d.sliderEvents).length > 0) out.sliderEvents = d.sliderEvents;
  if (d.shopClosures) out.shopClosures = true;
  if (d.specialSeasons.length > 0) out.specialSeasons = d.specialSeasons;
  if (d.monthlyWeather !== null) out.monthlyWeather = d.monthlyWeather;
  if (d.naSliders.length > 0) out.naSliders = d.naSliders;
  if (d.searchAliases.length > 0) out.searchAliases = d.searchAliases;
  if (Object.keys(d.activityStyleTiers).length > 0) out.activityStyleTiers = d.activityStyleTiers;

  return out;
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const legacy = RAW_DESTINATIONS as Record<string, unknown>[];
  console.log(`Validating and exporting ${legacy.length} legacy destinations...`);

  let failures = 0;
  let written = 0;

  for (const raw of legacy) {
    const result = destinationSchema.safeParse(raw);
    if (!result.success) {
      failures++;
      for (const line of formatValidationErrors(raw.id as string | undefined, result.error)) {
        console.error('  ' + line);
      }
      continue;
    }
    const cleaned = prune(result.data);
    writeFileSync(join(OUT_DIR, `${result.data.id}.json`), JSON.stringify(cleaned, null, 2) + '\n');
    written++;
  }

  console.log(`\nWrote ${written} files to ${OUT_DIR}`);
  if (failures > 0) {
    console.error(`FAILED: ${failures} destinations did not validate — see errors above.`);
    process.exit(1);
  }
  console.log('PASSED: every legacy destination validated cleanly against the new schema.');
}

main();
