import { notFound } from 'next/navigation';
import { getDestinationForAdmin } from '@/lib/db/queries/admin-destinations';
import { scorePlace } from '@/lib/db/queries/places';
import { getContinent } from '@/lib/scoring/continents';
import { SLIDERS, SLIDER_GROUPS } from '@/lib/scoring/constants';
import { PlaceProfileGrid, type ProfileCell } from '@/components/admin/PlaceProfileGrid';

export default async function PlaceProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getDestinationForAdmin(id);
  if (!row) notFound();

  const scored = scorePlace(row);
  const cells: ProfileCell[] = SLIDERS.map((s) => ({
    key: s.key,
    label: s.label,
    icon: s.icon,
    group: s.group,
    na: scored.naSliders.includes(s.key),
    base: scored.base[s.key] ?? null,
    monthly: scored.monthly[s.key] ?? new Array(12).fill(0),
    overrides: scored.scoreOverrides[s.key] ?? {},
  }));

  return (
    <PlaceProfileGrid
      destId={row.id}
      destName={row.name}
      destEmoji={row.emoji}
      region={row.region}
      continent={getContinent(row.id)}
      updatedAt={row.updatedAt.toISOString()}
      groups={SLIDER_GROUPS}
      cells={cells}
      initialBaseScores={scored.base}
    />
  );
}
