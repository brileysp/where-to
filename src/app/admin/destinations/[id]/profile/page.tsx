import { notFound } from 'next/navigation';
import { getDestinationForAdmin } from '@/lib/db/queries/admin-destinations';
import { scorePlace } from '@/lib/db/queries/places';
import { continentOf } from '@/lib/scoring/continents';
import { VISIBLE_SLIDERS, SLIDER_GROUPS } from '@/lib/scoring/constants';
import { PlaceProfileGrid, type ProfileCell } from '@/components/admin/PlaceProfileGrid';

export default async function PlaceProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getDestinationForAdmin(id);
  if (!row) notFound();

  const scored = scorePlace(row);
  const sliderMonthlyWeather = (row.sliderMonthlyWeather ?? {}) as Record<string, (string | null)[]>;
  const cells: ProfileCell[] = VISIBLE_SLIDERS.map((s) => ({
    key: s.key,
    label: s.label,
    icon: s.icon,
    group: s.group,
    na: scored.naSliders.includes(s.key),
    naReason: (row.naReasons as Record<string, { reason: string }> | undefined)?.[s.key]?.reason ?? null,
    base: scored.base[s.key] ?? null,
    monthly: scored.monthly[s.key] ?? new Array(12).fill(0),
    overrides: scored.scoreOverrides[s.key] ?? {},
    monthlyText: sliderMonthlyWeather[s.key] ?? [],
    tier: scored.signatureTier[s.key] ?? null,
  }));

  return (
    <PlaceProfileGrid
      destId={row.id}
      destName={row.name}
      destEmoji={row.emoji}
      region={row.region}
      continent={continentOf(row)}
      updatedAt={row.updatedAt.toISOString()}
      groups={SLIDER_GROUPS}
      cells={cells}
      initialBaseScores={scored.base}
      initialSliderMonthlyWeather={sliderMonthlyWeather}
      initialSignatureTier={scored.signatureTier}
      hazards={row.seasonalHazards}
      hazardSliders={VISIBLE_SLIDERS.map((s) => ({ key: s.key, label: s.label, icon: s.icon }))}
    />
  );
}
