import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The provider imports a server action; the page markup does not need it.
vi.mock('@/lib/admin/apply-edits', () => ({ applyAdminEdits: vi.fn() }));
import { PendingEditsProvider } from '@/components/admin/PendingEditsProvider';
import { PlanningCard } from '@/components/admin/interest-page/PlanningCard';
import { PlanningPill } from '@/components/admin/PlanningCells';
import type { InterestPageData, InterestPlaceRow } from '@/lib/admin/interest-pages/types';

const place = (id: string, name: string, swing: number): InterestPlaceRow =>
  ({ id, name, region: '', monthly: Array.from({ length: 12 }, (_, i) => (i === 0 ? 2 + swing : 2)), status: 'live', naReason: null, settingTags: ['city'], facts: {}, overview: '', monthlyText: [], stagedGenerationId: null }) as unknown as InterestPlaceRow;

const data = {
  key: 'shopping',
  label: 'Shopping',
  planning: { seasonalVariance: 2, evergreen: 4, stakes: 2, refreshEffort: 8, updatedAt: '2026-10-29T00:00:00.000Z', nextReviewOn: '2026-11-03', notes: { staleFirst: 'Stores and markets, tax-free rules', reviewTrigger: 'A tax-refund rule change', proposedBy: 'Claude, 29 Oct 2026', approved: { seasonalVariance: { by: 'Owner', at: '2026-10-29' } } } },
} as unknown as InterestPageData;

describe('Planning card', () => {
  it('shows the four scores, the cadence, the approval state and the places that break the pattern', () => {
    const places = [place('a', 'Paris', 1), place('b', 'Rome', 1), place('c', 'Lima', 1), place('d', 'Oslo', 1), place('e', 'Cairo', 1), place('f', 'Aspen Snowmass', 6)];
    const html = renderToStaticMarkup(createElement(PendingEditsProvider, null, createElement(PlanningCard, { data, places })));
    for (const label of ['Seasonal variance', 'Evergreen', 'Stakes', 'Refresh effort']) expect(html).toContain(label);
    expect(html).toContain('Monthly');
    expect(html).toContain('Approved by Owner');
    expect(html).toContain('Approve</button>');
    expect(html).toContain('Aspen Snowmass +5.0');
    expect(html).not.toContain('Paris +');
    expect(html).toContain('Stores and markets, tax-free rules');
  });
  it('says so when a score is not set', () => {
    expect(renderToStaticMarkup(createElement(PlanningPill, { k: 'stakes', score: null }))).toContain('not set');
    expect(renderToStaticMarkup(createElement(PlanningPill, { k: 'stakes', score: 9 }))).toContain('Critical');
  });
});

describe('Interests list', () => {
  it('shows the four planning columns and the next review', async () => {
    const { InterestsGrid } = await import('@/components/admin/InterestsGrid');
    const row = {
      key: 'fishing', label: 'Fishing', group: 'Sports & Recreation', emoji: '🎣', shortName: null, autoShortName: 'Fishing', updatedAt: '2026-10-29T00:00:00.000Z',
      labelOverride: null, groupOverride: null, hiddenOverride: null, tierOverride: null, orderOverride: null,
      builtIn: { label: 'Fishing', group: 'Sports & Recreation', hidden: false, tier: 'enthusiast', position: 1 }, hidden: false, tier: 'enthusiast',
      written: 0, na: 2, total: 200, completeness: 50, seasonalVariance: 8, evergreen: 5, stakes: 6, refreshEffort: 5, nextReviewOn: '2026-12-03', stale: { total: 6, current: 4, overdue: 1, never: 1 },
    };
    const html = renderToStaticMarkup(createElement(PendingEditsProvider, null, createElement(InterestsGrid, { initialRows: [row] as never })));
    for (const h of ['Seasonal variance', 'Evergreen', 'Stakes', 'Refresh effort', 'Next review', 'Staleness checks']) expect(html).toContain(h);
    expect(html).toContain('4 of 6 current'); expect(html).toContain('1 overdue');
    expect(html).toContain('Very high');
    expect(html).toContain('Quarterly');
    expect(html).toContain('3 Dec 2026');
  });
});
