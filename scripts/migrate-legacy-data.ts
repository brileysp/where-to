import { db } from '../src/lib/db/client';
import { destinations } from '../src/lib/db/schema';
import { RAW_DESTINATIONS } from './legacy/data.js';

interface LegacyDestination {
  id: string;
  name: string;
  region: string;
  emoji: string;
  climate: string;
  about: string;
  base: Record<string, number>;
  budgetBands?: string[];
  vibeBands?: string[];
  physicalBands?: string[];
  dry?: number[];
  wet?: number[];
  hot?: number[];
  cold?: number[];
  peak?: number[];
  low?: number[];
  peakIntensity?: 'mild' | 'moderate' | 'extreme';
  wildlifePeak?: number[];
  wildlifeClosed?: number[];
  birdingPeak?: number[];
  hikingBest?: number[];
  hikingWorst?: number[];
  inaccessible?: number[];
  swimHazard?: number[];
  noSnow?: number[];
  sliderCaps?: Record<string, number>;
  sliderEvents?: Record<string, { label: string; weight: number; months: Record<string, number> }[]>;
  shopClosures?: boolean;
  specialSeasons?: Array<{ months: number[]; text: string }>;
  monthlyWeather?: string[];
  searchAliases?: string[];
  naSliders?: string[];
  activityStyleTiers?: Record<string, Record<string, 'signature' | 'strong' | 'casual' | 'none'>>;
}

async function main() {
  const legacy = RAW_DESTINATIONS as LegacyDestination[];
  console.log(`Migrating ${legacy.length} destinations...`);

  await db.delete(destinations);

  for (const d of legacy) {
    await db.insert(destinations).values({
      id: d.id,
      name: d.name,
      region: d.region,
      emoji: d.emoji,
      climate: d.climate as 'tropical' | 'desert' | 'mediterranean' | 'temperate' | 'highland' | 'polar',
      about: d.about,
      baseScores: d.base,
      dryMonths: d.dry ?? [],
      wetMonths: d.wet ?? [],
      hotMonths: d.hot ?? [],
      coldMonths: d.cold ?? [],
      peakMonths: d.peak ?? [],
      lowMonths: d.low ?? [],
      peakIntensity: d.peakIntensity ?? null,
      wildlifePeakMonths: d.wildlifePeak ?? [],
      wildlifeClosedMonths: d.wildlifeClosed ?? [],
      birdingPeakMonths: d.birdingPeak ?? [],
      hikingBestMonths: d.hikingBest ?? [],
      hikingWorstMonths: d.hikingWorst ?? [],
      inaccessibleMonths: d.inaccessible ?? [],
      swimHazardMonths: d.swimHazard ?? [],
      noSnowMonths: d.noSnow ?? [],
      sliderCaps: d.sliderCaps ?? {},
      sliderEvents: d.sliderEvents ?? {},
      shopClosures: d.shopClosures ?? false,
      specialSeasons: d.specialSeasons ?? [],
      monthlyWeather: d.monthlyWeather ?? null,
      searchAliases: d.searchAliases ?? [],
      naSliders: d.naSliders ?? [],
      activityStyleTiers: d.activityStyleTiers ?? {},
      budgetBands: d.budgetBands ?? [],
      vibeBands: d.vibeBands ?? [],
      physicalBands: d.physicalBands ?? [],
    });
  }

  const count = await db.select().from(destinations);
  console.log(`Done. ${count.length} destinations in the database.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
