'use client';

import { InlineNumberCell } from './cells';
import { PLANNING_LABELS, planningTone, seasonalBand, reviewCadence, CADENCE_LABEL, stakesBand, effortBand, type PlanningKey, type Tone } from '@/lib/scoring/planning';

const TONE_STYLE: Record<Tone, { background: string; color: string }> = {
  hot: { background: 'var(--bad-soft, #f6dcd3)', color: 'var(--bad, #a8452a)' },
  warm: { background: 'var(--warn-soft, #f6ead0)', color: 'var(--warn, #8a6412)' },
  mild: { background: 'var(--bg-sunken, #eee9de)', color: 'var(--text-soft, #5a5546)' },
  cool: { background: 'var(--good-soft, #dcebe1)', color: 'var(--good, #2b7d4f)' },
};

/** The word that goes under or beside a score: its band, or for Evergreen the review cadence. */
export function planningWord(key: PlanningKey, score: number): string {
  if (key === 'seasonalVariance') return seasonalBand(score);
  if (key === 'evergreen') return CADENCE_LABEL[reviewCadence(score)];
  if (key === 'stakes') return stakesBand(score);
  return effortBand(score);
}

export function PlanningPill({ k, score }: { k: PlanningKey; score: number | null }) {
  if (score === null) return <span style={{ color: 'var(--text-faint)', fontSize: 11.5 }}>not set</span>;
  const t = TONE_STYLE[planningTone(k, score)];
  return <span title={PLANNING_LABELS[k].help} style={{ ...t, borderRadius: 999, padding: '1px 8px', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{planningWord(k, score)}</span>;
}

/** One planning score as an editable 1 to 10 number with its band beside it. Saves through the normal audited field edit. */
export function PlanningScoreCell({
  entityKey,
  entityLabel,
  loadedUpdatedAt,
  field,
  value,
  setLocal,
}: {
  entityKey: string;
  entityLabel: string;
  loadedUpdatedAt: string;
  field: PlanningKey;
  value: number | null;
  setLocal: (v: number | null) => void;
}) {
  return (
    <div className="cell-inner" style={{ gap: 8 }}>
      <InlineNumberCell
        ctx={{ entityType: 'interest', entityId: entityKey, entityLabel, field, fieldLabel: PLANNING_LABELS[field].label, loadedUpdatedAt }}
        value={value}
        setLocal={setLocal}
        width={56}
        step={1}
        min={1}
        max={10}
      />
      <PlanningPill k={field} score={value} />
    </div>
  );
}
