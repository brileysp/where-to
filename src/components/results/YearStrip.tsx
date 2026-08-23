import { MONTH_NAMES, MONTH_SHORT } from '@/lib/scoring/constants';
import { scoreForMonth, barColor } from '@/lib/scoring/rank';
import type { SelectedBands } from '@/lib/scoring/rank';
import type { ScoredDestination } from '@/lib/scoring/types';

export function YearStrip({
  dest,
  weights,
  bands,
  baseMonth,
  previewMonth,
  onBarClick,
}: {
  dest: ScoredDestination;
  weights: Record<string, number>;
  bands: SelectedBands;
  baseMonth: number;
  previewMonth: number;
  onBarClick: (m: number) => void;
}) {
  return (
    <div className="year-strip">
      {Array.from({ length: 12 }).map((_, i) => {
        const m = i + 1;
        const s = scoreForMonth(dest, weights, i, bands);
        const cls = ['year-bar'];
        if (m === baseMonth) cls.push('base');
        if (m === previewMonth) cls.push('selected');
        return (
          <div
            key={m}
            className={cls.join(' ')}
            title={`${MONTH_NAMES[i]}: ${s.toFixed(1)}/10`}
            onClick={() => onBarClick(m)}
          >
            <div className="year-bar-fill" style={{ height: `${Math.max(4, s * 10)}%`, background: barColor(s) }} />
            <span className={`year-bar-label${m === previewMonth ? ' selected' : ''}`}>{MONTH_SHORT[i][0]}</span>
          </div>
        );
      })}
    </div>
  );
}
