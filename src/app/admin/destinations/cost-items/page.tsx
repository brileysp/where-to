import { listDestinationsForAdmin } from '@/lib/db/queries/admin-destinations';
import { getContinent } from '@/lib/scoring/continents';
import { CostItemsGrid, type CostDestination } from '@/components/admin/CostItemsGrid';

export default async function AdminCostItemsPage() {
  const rows = await listDestinationsForAdmin();

  const destinations: CostDestination[] = rows.map((d) => ({
    id: d.id,
    name: d.name,
    emoji: d.emoji,
    region: d.region,
    continent: getContinent(d.id),
    items: d.costItems.map((c) => ({ label: c.label, price: c.price, unit: c.unit, emoji: c.emoji ?? null })),
    updatedAt: d.updatedAt.toISOString(),
  }));

  return <CostItemsGrid initialDestinations={destinations} />;
}
