import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CostsTab } from '@/components/results/CostsTab';
import { allCostSeasonalityKeys, costSeasonalityFor } from '@/lib/cost-seasonality';
import { PLACE } from '@/lib/places/keys.generated';
import type { ScoredDestination } from '@/lib/scoring/types';

const base = {
  name: 'Banff', costRange: { min: '$$$', max: '$$$$' }, costOverview: 'Pricey.',
  costItems: [{ label: 'Gondola', price: 60, unit: 'per person' }, { label: 'Hotel', price: 300, unit: 'per night' }],
};

describe('cost seasonality card (owner approved building it into the Cost tab, 19 Nov 2026)', () => {
  it('has a card for every place scored Fair or above, keyed by place key', () => {
    const keys = allCostSeasonalityKeys();
    expect(keys.length).toBe(191);
    for (const k of keys) expect(k).toMatch(/^p\d{4}$/);
    expect(costSeasonalityFor(PLACE.banff)).not.toBeNull();
    expect(costSeasonalityFor('nowhere')).toBeNull();
  });
  it('every card is well formed: 52 bars, a badge from the list, a sentence that reads, an average line inside the chart', () => {
    for (const k of allCostSeasonalityKeys()) {
      const c = costSeasonalityFor(k)!;
      expect(c.w, k).toHaveLength(52);
      expect(['Flat', 'Mild', 'Moderate', 'High', 'Extreme'], k).toContain(c.b);
      expect(c.s.length, k).toBeGreaterThan(20);
      expect(c.s, k).toMatch(/[.]$/);
      expect(c.s, k).not.toMatch(/\bp\d{4}\b|undefined|NaN|\bdear\b/i);
      expect(c.a, k).toBeGreaterThan(0);
      expect(c.a, k).toBeLessThanOrEqual(100);
      expect(Math.max(...c.w.filter((x): x is number => x !== null)), k).toBe(100);
      for (const x of c.w) if (x !== null) { expect(x).toBeGreaterThanOrEqual(3); expect(x).toBeLessThanOrEqual(100); }
      for (const i of c.p) { expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(52); expect(c.w[i], k).not.toBeNull(); }
    }
  });
  it('shows the card below the cost items, with its sentence, badge, bars and month letters', () => {
    const card = costSeasonalityFor(PLACE.banff)!;
    const html = renderToStaticMarkup(createElement(CostsTab, { dest: { ...base, costSeasonality: card } as unknown as ScoredDestination }));
    expect(html.indexOf('Cost seasonality')).toBeGreaterThan(html.indexOf('price-list'));
    expect(html).toContain(card.s);
    expect(html).toContain(`>${card.b}</span>`);
    expect((html.match(/<i /g) ?? []).length + (html.match(/<i>/g) ?? []).length).toBeGreaterThanOrEqual(52);
    expect(html).toContain('average price');
  });
  it('shows nothing extra when a place has no card', () => {
    const html = renderToStaticMarkup(createElement(CostsTab, { dest: base as unknown as ScoredDestination }));
    expect(html).not.toContain('Cost seasonality');
  });
  it('draws closed weeks as hatched stubs and partly closed weeks faded', () => {
    const acadia = costSeasonalityFor(PLACE.acadia)!;
    const html = renderToStaticMarkup(createElement(CostsTab, { dest: { ...base, costSeasonality: acadia } as unknown as ScoredDestination }));
    expect(html).toContain('class="closed"');
    expect(html).toContain('class="faded"');
  });
});
