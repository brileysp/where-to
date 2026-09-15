import { listInterestMetaForAdmin } from '@/lib/db/queries/admin-interests';
import { VISIBLE_SLIDERS } from '@/lib/scoring/constants';
import { InterestsGrid, type InterestRow } from '@/components/admin/InterestsGrid';

export default async function AdminInterestsPage() {
  const metaRows = await listInterestMetaForAdmin();
  const metaByKey = new Map(metaRows.map((r) => [r.key, r]));

  const rows: InterestRow[] = VISIBLE_SLIDERS.map((s) => {
    const meta = metaByKey.get(s.key);
    return {
      key: s.key,
      label: s.label,
      group: s.group,
      emoji: meta?.emoji ?? s.icon,
      updatedAt: (meta?.updatedAt ?? new Date()).toISOString(),
    };
  });

  return <InterestsGrid initialRows={rows} />;
}
