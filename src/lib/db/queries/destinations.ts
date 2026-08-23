import { db } from '../client';
import { destinations } from '../schema';
import { deriveDestinationScores } from '@/lib/scoring/destinations';
import type { ScoredDestination, ScoringDestination } from '@/lib/scoring/types';
import type { destinations as DestinationsTable } from '../schema';
import type { InferSelectModel } from 'drizzle-orm';

type DestinationRow = InferSelectModel<typeof DestinationsTable>;

/**
 * Maps a Postgres row (camelCase columns, e.g. `dryMonths`) to the legacy
 * field-name shape the ported scoring functions expect (e.g. `dry`) — see
 * the comment in scoring/types.ts for why the ported functions keep the
 * legacy names rather than being touched up to match the schema.
 */
export function toScoringDestination(row: DestinationRow): ScoringDestination {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    emoji: row.emoji,
    climate: row.climate,
    about: row.about,
    overview: row.overview,
    costRange: row.costMin && row.costMax ? { min: row.costMin, max: row.costMax } : null,
    costOverview: row.costOverview,
    costItems: row.costItems,
    base: row.baseScores,
    budgetBands: row.budgetBands,
    vibeBands: row.vibeBands,
    physicalBands: row.physicalBands,
    dry: row.dryMonths,
    wet: row.wetMonths,
    hot: row.hotMonths,
    cold: row.coldMonths,
    peak: row.peakMonths,
    low: row.lowMonths,
    peakIntensity: row.peakIntensity,
    wildlifePeak: row.wildlifePeakMonths,
    wildlifeClosed: row.wildlifeClosedMonths,
    birdingPeak: row.birdingPeakMonths,
    hikingBest: row.hikingBestMonths,
    hikingWorst: row.hikingWorstMonths,
    inaccessible: row.inaccessibleMonths,
    swimHazard: row.swimHazardMonths,
    noSnow: row.noSnowMonths,
    sliderCaps: row.sliderCaps,
    sliderEvents: row.sliderEvents,
    shopClosures: row.shopClosures,
    specialSeasons: row.specialSeasons,
    monthlyWeather: row.monthlyWeather,
    naSliders: row.naSliders,
    searchAliases: row.searchAliases,
    activityStyleTiers: row.activityStyleTiers,
  };
}

export function scoreDestination(row: DestinationRow): ScoredDestination {
  const scoring = toScoringDestination(row);
  const derived = deriveDestinationScores(scoring);
  return { ...scoring, ...derived };
}

export async function getAllScoredDestinations(): Promise<ScoredDestination[]> {
  const rows = await db.select().from(destinations);
  return rows.map(scoreDestination);
}
