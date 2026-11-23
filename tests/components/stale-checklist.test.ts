// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';

vi.mock('@/app/admin/destinations/interests/[key]/stale-actions', () => ({ addFactor: vi.fn(), loadChecklist: vi.fn(), recordCheck: vi.fn(), setFactorActive: vi.fn(), updateFactor: vi.fn(), setOptOut: vi.fn() }));

import { StaleChecklist } from '@/components/admin/interest-page/StaleChecklist';
import type { StaleFactorRow } from '@/lib/admin/stale-checks';

const f = (id: string, category: StaleFactorRow['category'], statement: string, extra: Partial<StaleFactorRow> = {}): StaleFactorRow => ({ id, interestKey: 'hiking', category, statement, howToCheck: '', checker: 'owner', checkEvery: null, sortOrder: 0, active: true, last: null, thisRound: null, ...extra });
const recent = { result: 'checked' as const, note: '', checkedBy: 'a@b.c', checkedAt: new Date().toISOString(), todoId: 't1' };

const strip = (h: string) => h.replace(/<!-- -->/g, '');
describe('Staleness checks card', () => {
  const factors = [
    f('1', 'Rules', 'Permit systems change', { thisRound: recent, last: recent, howToCheck: 'Park authority page' }),
    f('2', 'Nature and climate', 'Snow-free season shifts'),
    f('3', 'Rules', 'An old reason', { active: false }),
  ];
  it('groups the reasons by type and shows progress for the open review', () => {
    const html = strip(renderToString(createElement(StaleChecklist, { interestKey: 'hiking', evergreen: 5, initial: { factors, round: { id: 't1', dueOn: '2026-12-01' } } })));
    expect(html).toContain('Rules'); expect(html).toContain('Nature and climate');
    expect(html).toContain('Permit systems change'); expect(html).toContain('Snow-free season shifts');
    expect(html).toContain('This review:'); expect(html).toContain('1 of 2 reasons have a result');
    expect(html).toContain('1 to go'); expect(html).toContain('Park authority page'); expect(html).toContain('not written yet');
    expect(html).toContain('Checked, still true'); expect(html).toContain('Does not apply'); expect(html).toContain('never checked');
  });
  it('hides retired reasons until asked and offers no result buttons without an open review', () => {
    const html = strip(renderToString(createElement(StaleChecklist, { interestKey: 'hiking', evergreen: 5, initial: { factors, round: null } })));
    expect(html).not.toContain('An old reason'); expect(html).toContain('Show 1 retired'); expect(html).toContain('No open review');
    expect(html).not.toContain('Checked, still true');
  });

  it('shows the site-wide reasons in an interest, asks only the due ones, and shows an opt-out', () => {
    const site = (id: string, statement: string, extra: Partial<StaleFactorRow> = {}): StaleFactorRow => ({ ...f(id, 'Rules', statement, { interestKey: '_site', checkEvery: 'annually' }), inherited: true, ...extra });
    const list = [
      f('1', 'Rules', 'Own reason'),
      site('s1', 'Overtourism caps arrive'), // never checked for this interest: due
      site('s2', 'Climate shifts the calendar', { last: { ...recent, checkedAt: new Date(Date.now() - 30 * 86_400_000).toISOString() } }), // checked a month ago, yearly: not due
      site('s3', 'Transport and access change', { optedOut: true, optOutNote: 'Everything happens in one town' }),
    ];
    const html = strip(renderToString(createElement(StaleChecklist, { interestKey: 'hiking', evergreen: 5, initial: { factors: list, round: { id: 't1', dueOn: null } } })));
    expect(html).toContain('Reasons that apply to every interest'); expect(html).toContain('Overtourism caps arrive');
    expect(html).toContain('Not due this review'); expect(html).toContain('Does not apply to this interest: Everything happens in one town');
    expect(html).toContain('Ask again'); expect(html).toContain('0 of 2 reasons have a result'); // the own reason and the one due site-wide reason
  });
  it('is an editor with no result buttons for the site-wide list', () => {
    const list = [f('s1', 'Rules', 'Overtourism caps arrive', { interestKey: '_site' })];
    const html = strip(renderToString(createElement(StaleChecklist, { interestKey: '_site', evergreen: null, initial: { factors: list, round: null } })));
    expect(html).toContain('Reasons that apply to every interest'); expect(html).toContain('Add a reason'); expect(html).not.toContain('Checked, still true'); expect(html).not.toContain('This review');
  });
});
