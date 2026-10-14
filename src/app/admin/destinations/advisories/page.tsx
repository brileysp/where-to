import { listDestinationsForAdmin } from '@/lib/db/queries/admin-destinations';
import { continentOf } from '@/lib/scoring/continents';
import { AdvisoriesGrid, type AdvisoryRow } from '@/components/admin/AdvisoriesGrid';

export default async function AdminAdvisoriesPage() {
  const rows = await listDestinationsForAdmin();

  const advisoryRows: AdvisoryRow[] = rows.map((d) => ({
    id: d.id,
    name: d.name,
    emoji: d.emoji,
    continent: continentOf(d),
    travelAdvisories: d.travelAdvisories,
    updatedAt: d.updatedAt.toISOString(),
  }));

  return <AdvisoriesGrid initialRows={advisoryRows} />;
}
