import { describe, expect, it } from 'vitest';
import { auditDiff, isSubDiff, mergeSub } from '@/lib/admin/audit-diff';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'bali', name: 'Bali', region: 'Indonesia', baseScores: [1, 2, 3],
  sliderCurves: { surfing: [1, 2, 3], diving: [4, 5, 6], birding: [7, 8, 9] },
  sliderOverview: { surfing: 'Old text', diving: 'Dive text' },
  ...over,
});

describe('audit diff', () => {
  it('stores only the changed columns, and only the changed keys of a keyed column', () => {
    const d = auditDiff(row(), row({ name: 'Bali & Lombok', sliderCurves: { surfing: [9, 9, 9], diving: [4, 5, 6], birding: [7, 8, 9] } }))!;
    expect(Object.keys(d.after).sort()).toEqual(['name', 'sliderCurves']);
    expect(d.after.name).toBe('Bali & Lombok');
    expect(d.before.name).toBe('Bali');
    expect(d.after.sliderCurves).toEqual({ __sub: { surfing: [9, 9, 9] } });
    expect(d.before.sliderCurves).toEqual({ __sub: { surfing: [1, 2, 3] } });
  });
  it('leaves out id and unchanged columns, and nothing at all when nothing changed', () => {
    expect(auditDiff(row(), row())).toEqual({ before: {}, after: {} });
  });
  it('records an added key as null before and a removed key as null after', () => {
    const d = auditDiff(row(), row({ sliderOverview: { surfing: 'Old text', hiking: 'New hiking text' } }))!;
    expect(d.after.sliderOverview).toEqual({ __sub: { diving: null, hiking: 'New hiking text' } });
    expect(d.before.sliderOverview).toEqual({ __sub: { diving: 'Dive text', hiking: null } });
  });
  it('stores an array or number column whole', () => {
    expect(auditDiff(row(), row({ baseScores: [1, 2, 4] }))!.after).toEqual({ baseScores: [1, 2, 4] });
  });
  it('returns null for a create or delete (no before or after)', () => {
    expect(auditDiff(null, row())).toBeNull();
    expect(auditDiff(row(), null)).toBeNull();
  });
  it('restoring a stored entry merges into the live value and leaves other keys alone', () => {
    const before = row();
    const after = row({ sliderOverview: { surfing: 'New text', diving: 'Dive text' } });
    const d = auditDiff(before, after)!;
    const live = { surfing: 'Newest text', diving: 'Dive text, edited later', birding: 'Added later' };
    expect(isSubDiff(d.after.sliderOverview)).toBe(true);
    expect(mergeSub(live, d.after.sliderOverview)).toEqual({ surfing: 'New text', diving: 'Dive text, edited later', birding: 'Added later' });
  });
  it('a null key removes it on restore, and a plain value replaces the column', () => {
    expect(mergeSub({ a: 1, b: 2 }, { __sub: { a: null } })).toEqual({ b: 2 });
    expect(mergeSub([1, 2], [3, 4])).toEqual([3, 4]);
  });
});
