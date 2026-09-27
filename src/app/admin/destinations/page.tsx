import { listDestinationsForAdmin } from '@/lib/db/queries/admin-destinations';
import { getContinent } from '@/lib/scoring/continents';
import { PlacesGrid, type PlaceRow } from '@/components/admin/PlacesGrid';

export default async function AdminDestinationsPage() {
  const rows = await listDestinationsForAdmin();

  const placeRows: PlaceRow[] = rows.map((d) => ({
    id: d.id,
    name: d.name,
    emoji: d.emoji,
    region: d.region,
    continent: getContinent(d.id),
    overview: d.overview,
    about: d.about,
    monthlyWeather: d.monthlyWeather,
    peakIntensity: d.peakIntensity,
    hotSeverity: d.hotSeverity,
    coldSeverity: d.coldSeverity,
    wetSeverity: d.wetSeverity,
    crowdBaseline: d.crowdBaseline,
    costMin: d.costMin,
    costMax: d.costMax,
    costOverview: d.costOverview,
    climate: d.climate,
    budgetBands: d.budgetBands,
    vibeBands: d.vibeBands,
    physicalBands: d.physicalBands,
    placeType: d.placeType,
    settingTags: d.settingTags,
    audienceBands: d.audienceBands,
    searchAliases: d.searchAliases,
    specialSeasons: d.specialSeasons,
    travelAdvisories: d.travelAdvisories,
    updatedAt: d.updatedAt.toISOString(),
  }));

  return <PlacesGrid initialRows={placeRows} />;
}
