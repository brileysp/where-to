import { listInterestMetaForAdmin } from '@/lib/db/queries/admin-interests';
import { getAllInterestCompleteness, getInterestCoverage, getLastPassFinishedByInterest } from '@/lib/db/queries/interest-pages';
import { SLIDERS } from '@/lib/scoring/constants';
import { builtInSlider } from '@/lib/scoring/overrides';
import { shortInterestLabel } from '@/lib/scoring/shortName';
import { InterestsGrid, type InterestRow } from '@/components/admin/InterestsGrid';

export default async function AdminInterestsPage() {
  const [metaRows, coverage, completeness, lastPasses] = await Promise.all([listInterestMetaForAdmin(), getInterestCoverage(), getAllInterestCompleteness(), getLastPassFinishedByInterest()]);
  const metaByKey = new Map(metaRows.map((r) => [r.key, r]));

  // Every interest, hidden ones included, so a hidden interest can be shown again from here.
  const rows: InterestRow[] = [...SLIDERS].map((s) => {
    const meta = metaByKey.get(s.key);
    const base = builtInSlider(s.key)!;
    return {
      key: s.key,
      label: s.label,
      group: s.group,
      emoji: meta?.emoji ?? s.icon,
      shortName: meta?.shortName ?? null,
      autoShortName: shortInterestLabel(s.label),
      updatedAt: (meta?.updatedAt ?? new Date()).toISOString(),
      labelOverride: meta?.label ?? null,
      groupOverride: meta?.groupName ?? null,
      hiddenOverride: meta?.hidden ?? null,
      tierOverride: meta?.audienceTier ?? null,
      orderOverride: meta?.sortOrder ?? null,
      builtIn: { label: base.label, group: base.group, hidden: !!base.hidden, tier: base.audienceTier, position: base.index + 1 },
      hidden: !!s.hidden,
      tier: s.audienceTier,
      written: coverage[s.key]?.written ?? 0,
      na: coverage[s.key]?.na ?? 0,
      total: coverage[s.key]?.total ?? 0,
      completeness: completeness[s.key]?.score ?? 0,
      lastPass: lastPasses[s.key],
    };
  });

  return <InterestsGrid initialRows={rows} />;
}
