import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CostsTab } from '@/components/results/CostsTab';
import type { ScoredDestination } from '@/lib/scoring/types';

const dest = {
  name: 'Okavango Delta',
  costRange: { min: '$$$$$', max: '$$$$$' },
  costOverview: 'All-inclusive.',
  costItems: [
    { label: 'Mokoro canoe safari', price: 80, unit: 'per person', emoji: '🛶' },
    { label: 'Scenic helicopter flight', price: 380, unit: '', emoji: '🚁' },
    { label: 'Simple tented camp', price: 800, unit: 'per person, per night' },
  ],
} as unknown as ScoredDestination;

describe('public cost tab icons', () => {
  it('shows the saved emoji when an item has one, and the keyword guess when it does not', () => {
    const html = renderToStaticMarkup(createElement(CostsTab, { dest }));
    expect(html).toContain('>🛶</span>Mokoro canoe safari');
    expect(html).toContain('>🚁</span>Scenic helicopter flight');
    expect(html).toContain('>🏕️</span>Simple tented camp');
  });
});
