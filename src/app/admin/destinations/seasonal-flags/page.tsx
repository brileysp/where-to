import { listDestinationsForAdmin } from '@/lib/db/queries/admin-destinations';
import { getContinent } from '@/lib/scoring/continents';
import { SeasonalFlagsGrid, type SeasonalFlagsRow } from '@/components/admin/SeasonalFlagsGrid';

export default async function AdminSeasonalFlagsPage() {
  const rows = await listDestinationsForAdmin();

  const flagRows: SeasonalFlagsRow[] = rows.map((d) => ({
    id: d.id,
    name: d.name,
    emoji: d.emoji,
    continent: getContinent(d.id),
    dryMonths: d.dryMonths,
    wetMonths: d.wetMonths,
    hotMonths: d.hotMonths,
    coldMonths: d.coldMonths,
    peakMonths: d.peakMonths,
    lowMonths: d.lowMonths,
    wildlifePeakMonths: d.wildlifePeakMonths,
    wildlifeClosedMonths: d.wildlifeClosedMonths,
    birdingPeakMonths: d.birdingPeakMonths,
    hikingBestMonths: d.hikingBestMonths,
    hikingWorstMonths: d.hikingWorstMonths,
    inaccessibleMonths: d.inaccessibleMonths,
    swimHazardMonths: d.swimHazardMonths,
    noSnowMonths: d.noSnowMonths,
    shopClosures: d.shopClosures,
    updatedAt: d.updatedAt.toISOString(),
  }));

  return <SeasonalFlagsGrid initialRows={flagRows} />;
}
