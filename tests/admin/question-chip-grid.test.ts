import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ChipRow, QuestionRow } from '@/lib/admin/interest-pages/types';

vi.mock('@/app/admin/destinations/interests/[key]/question-actions', () => ({
  setQuestionChipLink: vi.fn(),
  acceptSuggestedLinks: vi.fn(),
  dismissSuggestedLinks: vi.fn(),
}));

const chip = (key: string, label: string, order: number, status: 'live' | 'draft' = 'draft'): ChipRow => ({ key, label, order, status, drivers: [], needsColumn: '', approvedBy: 'x', approvedAt: '2026-10-21T00:00:00Z' });
const q = (key: string, text: string, order: number, whenChips: string[], suggestedChips: string[], kind: 'lean' | 'limit' = 'lean'): QuestionRow => ({ key, order, text, options: ['a', 'b'], maxPicks: 1, kind, columns: [], note: '', missMessage: '', whenChips, suggestedChips, approvedBy: 'x', approvedAt: '2026-10-21T00:00:00Z' });

describe('the question and chip grid', () => {
  it('draws one row per question and one column per chip, with solid, suggested and empty cells', async () => {
    const { QuestionChipGrid } = await import('@/components/admin/interest-page/QuestionChipGrid');
    const html = renderToStaticMarkup(
      h(QuestionChipGrid, { interestKey: 'cyclingRoad', chips: [chip('touring', 'Multi-day touring', 1, 'live'), chip('gravel', 'Gravel and dirt roads', 2)], questions: [q('q1', 'How hard are your rides?', 1, [], [], 'limit'), q('q2', 'Supported or self-supported?', 2, ['touring'], ['gravel'])], setQuestions: () => {} }),
    );
    expect(html).toContain('Multi-day touring');
    expect(html).toContain('Gravel and dirt roads');
    expect(html).toContain('How hard are your rides?');
    expect(html).toContain('ip-gdot on');
    expect(html).toContain('ip-gdot sug');
    expect(html).toContain('1 suggested');
    expect(html).toContain('Accept all suggested');
    expect((html.match(/only when ticked/g) ?? []).length).toBe(1);
    expect((html.match(/>always</g) ?? []).length).toBe(1);
  });
  it('hides the accept buttons when nothing is suggested', async () => {
    const { QuestionChipGrid } = await import('@/components/admin/interest-page/QuestionChipGrid');
    const html = renderToStaticMarkup(h(QuestionChipGrid, { interestKey: 'x', chips: [chip('a', 'A', 1)], questions: [q('q1', 'One?', 1, ['a'], [])], setQuestions: () => {} }));
    expect(html).not.toContain('Accept all suggested');
  });
});
