'use client';

import { MONTH_LABEL_POSITIONS, MONTH_LETTERS, type CostSeasonality } from '@/lib/cost-seasonality';

/** The cost seasonality card: title with a one-word badge, the sentence, then 52 weekly bars with a dashed average-price line. */
export function CostSeasonalityCard({ card }: { card: CostSeasonality }) {
  const faded = new Set(card.p);
  return (
    <div className="detail-plain cost-season">
      <div className="cost-season-head">
        <div className="detail-section-title">Cost seasonality</div>
        <span className="cost-season-badge">{card.b}</span>
      </div>
      <p className="cost-season-text">{card.s}</p>
      <div className="cost-season-bars" role="img" aria-label={`Hotel prices by week through the year. ${card.s}`}>
        <div className="cost-season-avg" style={{ bottom: `${card.a}%` }} />
        {card.w.map((h, i) =>
          h === null ? (
            <i key={i} className="closed" />
          ) : (
            <i key={i} className={faded.has(i) ? 'faded' : undefined} style={{ height: `${h}%` }} />
          ),
        )}
      </div>
      <div className="cost-season-axis" aria-hidden="true">
        {MONTH_LETTERS.map((m, i) => (
          <span key={i} style={{ left: `${MONTH_LABEL_POSITIONS[i]}%` }}>{m}</span>
        ))}
      </div>
      <div className="cost-season-legend"><i />average price</div>
    </div>
  );
}
