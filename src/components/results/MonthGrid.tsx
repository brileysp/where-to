import { MONTH_SHORT } from '@/lib/scoring/constants';

export function MonthGrid({
  month,
  monthChosen,
  onChoose,
}: {
  month: number | null;
  monthChosen: boolean;
  onChoose: (m: number) => void;
}) {
  return (
    <div className="month-grid">
      {MONTH_SHORT.map((label, i) => {
        const m = i + 1;
        return (
          <button
            key={m}
            type="button"
            className={`month-btn${m === month && monthChosen ? ' active' : ''}`}
            onClick={(e) => {
              // Some mobile browsers auto-scroll a just-tapped button into
              // a "comfortable" middle-of-screen position on their own,
              // which can fire after (and override) the deliberate
              // scroll-to-results below. Blurring removes the focused
              // element that behavior keys off of.
              e.currentTarget.blur();
              onChoose(m);
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
