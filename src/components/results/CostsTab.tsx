'use client';

import { useUnitText } from '@/components/UnitsProvider';
import { useState } from 'react';
import { costItemIcon, formatPrice } from '@/lib/scoring/costIcons';
import type { ScoredDestination } from '@/lib/scoring/types';

const COST_TIER_KEY = '$ under $100/day · $$ $100–200 · $$$ $200–400 · $$$$ $400–800 · $$$$$ $800+';

export function CostsTab({ dest }: { dest: ScoredDestination }) {
  const [showKey, setShowKey] = useState(false);
  const u = useUnitText();

  if (!dest.costRange) {
    return (
      <div className="detail-tab-content">
        <p className="about-text">Cost details aren&apos;t available for {dest.name} yet.</p>
      </div>
    );
  }

  return (
    <div className="detail-tab-content">
      <div className="detail-card">
        <div className="cost-range-header">
          <div className="cost-range-label">
            {dest.costRange.min}
            {dest.costRange.max !== dest.costRange.min ? ` – ${dest.costRange.max}` : ''}
          </div>
          <div className="cost-range-hint">daily cost range</div>
          <button
            type="button"
            className={`cost-key-toggle${showKey ? ' active' : ''}`}
            onClick={() => setShowKey((v) => !v)}
            aria-label="What do the $ tiers mean?"
          >
            i
          </button>
        </div>
        {showKey && <div className="cost-key-text">{COST_TIER_KEY}</div>}

        {dest.costOverview && <p className="cost-overview-text">{u(dest.costOverview)}</p>}
      </div>

      <div className="detail-card">
        <div className="price-list">
          {[...dest.costItems].sort((a, b) => a.price - b.price).map((item, i) => (
            <div className="price-row" key={i}>
              <span className="price-item">
                <span className="price-icon">{item.emoji || costItemIcon(item.label)}</span>
                {item.label}
                {item.unit ? `, ${item.unit}` : ''}
              </span>
              <span className="price-val">${formatPrice(item.price)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
