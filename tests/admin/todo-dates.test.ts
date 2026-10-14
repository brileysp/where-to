import { describe, it, expect } from 'vitest';
import { attentionCount, compareTodos, dueInfo, nextDueOn, todayIso } from '@/lib/admin/todo-dates';

describe('nextDueOn', () => {
  it('steps a weekly item one week on', () => expect(nextDueOn('2026-10-21', 'weekly', '2026-10-21')).toBe('2026-10-28'));
  it('skips dates already past', () => expect(nextDueOn('2026-10-01', 'weekly', '2026-10-21')).toBe('2026-10-22'));
  it('clamps a monthly item to the end of a short month', () => expect(nextDueOn('2026-01-31', 'monthly', '2026-01-31')).toBe('2026-02-28'));
  it('starts from today when there is no date', () => expect(nextDueOn(null, 'monthly', '2026-10-14')).toBe('2026-11-14'));
});

describe('dueInfo', () => {
  it('flags overdue', () => expect(dueInfo('2026-10-12', '2026-10-14')).toEqual({ text: 'overdue by 2 days', tone: 'over' }));
  it('says tomorrow', () => expect(dueInfo('2026-10-15', '2026-10-14')).toEqual({ text: 'tomorrow', tone: 'soon' }));
  it('counts days ahead', () => expect(dueInfo('2026-11-03', '2026-10-14')).toEqual({ text: 'in 20 days', tone: 'later' }));
});

describe('compareTodos and attentionCount', () => {
  const base = { status: 'idea', priority: 2, createdAt: '2026-10-01' };
  it('puts dated items before undated, soonest first', () => {
    const list = [{ ...base, dueOn: null }, { ...base, dueOn: '2026-11-03' }, { ...base, dueOn: '2026-10-17' }];
    expect(list.sort(compareTodos).map((t) => t.dueOn)).toEqual(['2026-10-17', '2026-11-03', null]);
  });
  it('counts needs-you and overdue, never done items', () => {
    const rows = [
      { status: 'needs_you', dueOn: null },
      { status: 'idea', dueOn: '2026-10-01' },
      { status: 'idea', dueOn: null },
      { status: 'done', dueOn: '2026-10-01' },
    ];
    expect(attentionCount(rows, '2026-10-14')).toBe(2);
  });
});

describe('todayIso', () => {
  it('uses the Pacific date, not UTC', () => expect(todayIso(new Date('2026-10-15T03:00:00Z'))).toBe('2026-10-14'));
});
