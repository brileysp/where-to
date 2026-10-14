import { listDestinationsForAdmin, listRetiredPlacesForAdmin } from '@/lib/db/queries/admin-destinations';
import { continentOf } from '@/lib/scoring/continents';
import { PlacesGrid, type PlaceRow } from '@/components/admin/PlacesGrid';

export default async function AdminDestinationsPage({ searchParams }: { searchParams: Promise<{ retired?: string }> }) {
  const { retired } = await searchParams;
  const showRetired = retired === '1';
  const rows = [...(await listDestinationsForAdmin()), ...(showRetired ? await listRetiredPlacesForAdmin() : [])];

  const placeRows: PlaceRow[] = rows.map((d) => ({
    id: d.id,
    name: d.name,
    emoji: d.emoji,
    region: d.region,
    continent: continentOf(d),
    continentSaved: d.continent ?? null,
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
    gated: d.gated,
    gatedInterests: d.gatedInterests,
    isPrimaryDestination: d.isPrimaryDestination,
    isPublished: d.isPublished,
    parentPlaceId: d.parentPlaceId ?? null,
    summary: d.summary ?? null,
    countryCode: d.countryCode ?? null,
    regionLabel: d.regionLabel ?? null,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    stampDesign: (d.stampDesign as Record<string, unknown> | null) ?? null,
    searchAliases: d.searchAliases,
    specialSeasons: d.specialSeasons,
    travelAdvisories: d.travelAdvisories,
    updatedAt: d.updatedAt.toISOString(),
  }));

  return <PlacesGrid initialRows={placeRows} showRetired={showRetired} />;
}
