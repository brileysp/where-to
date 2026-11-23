import { requireAdminUser } from '@/lib/admin/auth';
import { getTravelNeedsRows } from '@/lib/db/queries/travel-needs';
import { TravelNeedsGrid } from '@/components/admin/TravelNeedsGrid';

export default async function AdminTravelNeedsPage() {
  await requireAdminUser();
  const rows = await getTravelNeedsRows();
  return <TravelNeedsGrid initialRows={rows} />;
}
