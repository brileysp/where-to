import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'path';
import { eq } from 'drizzle-orm';
import * as schema from '@/lib/db/schema';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db/client', () => ({
  get db() {
    return h.db;
  },
}));
vi.mock('@/lib/admin/auth', () => ({
  requireAdminUser: async () => ({ id: '00000000-0000-0000-0000-000000000001', email: 'tester@example.com' }),
}));

describe('question actions', () => {
  let a: typeof import('@/app/admin/destinations/interests/[key]/question-actions');
  beforeAll(async () => {
    const db = drizzle(new PGlite(), { schema });
    h.db = db;
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
    a = await import('@/app/admin/destinations/interests/[key]/question-actions');
  });

  it('creates a question, numbers it, and keeps the order 1 to n when moved', async () => {
    const q1 = await a.createQuestion('hiking');
    const q2 = await a.createQuestion('hiking');
    if (!q1.ok || !q2.ok) throw new Error('create failed');
    expect([q1.question.key, q2.question.key]).toEqual(['q1', 'q2']);
    expect(q1.question.approvedAt).toBeNull();
    const moved = await a.moveQuestion('hiking', 'q2', 'up');
    expect(moved.ok && moved.order).toEqual([{ key: 'q2', order: 1 }, { key: 'q1', order: 2 }]);
  });

  it('checks the wording, the columns and the number of picks', async () => {
    expect((await a.updateQuestion('hiking', 'q1', { options: ['Only one'] })).ok).toBe(false);
    expect((await a.updateQuestion('hiking', 'q1', { columns: ['nope'] })).ok).toBe(false);
    expect((await a.updateQuestion('hiking', 'q1', { maxPicks: 3 })).ok).toBe(false); // two answers only
    expect((await a.updateQuestion('hiking', 'q1', { columns: ['altitude'], kind: 'limit' })).ok).toBe(true);
    expect((await a.updateQuestion('nowhere', 'q1', { kind: 'lean' })).ok).toBe(false);
  });

  it('approves, and takes the approval back when the wording changes but not for other edits', async () => {
    const ok = await a.setQuestionApproval('hiking', 'q1', true);
    expect(ok.ok && ok.question.approvedBy).toBe('tester@example.com');
    const kind = await a.updateQuestion('hiking', 'q1', { kind: 'lean' });
    expect(kind.ok && kind.approvalCleared).toBe(false);
    expect(kind.ok && kind.question.approvedAt).toBeTruthy();
    const reworded = await a.updateQuestion('hiking', 'q1', { text: 'A different question?' });
    expect(reworded.ok && reworded.approvalCleared).toBe(true);
    expect(reworded.ok && reworded.question.approvedAt).toBeNull();
  });

  it('deletes a question', async () => {
    expect((await a.deleteQuestion('hiking', 'q2')).ok).toBe(true);
    expect((await a.deleteQuestion('hiking', 'q2')).ok).toBe(false);
  });

  it('sets which chips open a question, checks they belong to the interest, and takes the approval back when they change', async () => {
    const dbx = h.db as ReturnType<typeof drizzle<typeof schema>>;
    await dbx.insert(schema.interestChips).values([{ interestKey: 'scenicLandscapes', chipKey: 'photo', label: 'Landscape photography' }, { interestKey: 'scenicLandscapes', chipKey: 'coasts', label: 'Coasts' }, { interestKey: 'hiking', chipKey: 'hut', label: 'Hut-to-hut' }]);
    const q = await a.createQuestion('scenicLandscapes');
    if (!q.ok) throw new Error('create failed');
    expect(q.question.whenChips).toEqual([]);
    expect((await a.setQuestionChips('scenicLandscapes', q.question.key, ['hut'])).ok).toBe(false); // a hiking chip
    expect((await a.setQuestionChips('scenicLandscapes', q.question.key, ['nope'])).ok).toBe(false);
    await a.setQuestionApproval('scenicLandscapes', q.question.key, true);
    const set = await a.setQuestionChips('scenicLandscapes', q.question.key, ['photo', 'coasts', 'photo']);
    expect(set.ok && set.question.whenChips).toEqual(['coasts', 'photo']);
    expect(set.ok && set.approvalCleared).toBe(true);
    const same = await a.setQuestionChips('scenicLandscapes', q.question.key, ['coasts', 'photo']);
    expect(same.ok && same.approvalCleared).toBe(false);
    const back = await a.setQuestionChips('scenicLandscapes', q.question.key, []);
    expect(back.ok && back.question.whenChips).toEqual([]);
  });

  it('keeps the chips when the wording is edited or the question is approved', async () => {
    const q = await a.createQuestion('scenicLandscapes');
    if (!q.ok) throw new Error('create failed');
    await a.setQuestionChips('scenicLandscapes', q.question.key, ['photo']);
    const edited = await a.updateQuestion('scenicLandscapes', q.question.key, { text: 'How far for the shot?' });
    expect(edited.ok && edited.question.whenChips).toEqual(['photo']);
    const approved = await a.setQuestionApproval('scenicLandscapes', q.question.key, true);
    expect(approved.ok && approved.question.whenChips).toEqual(['photo']);
  });

  it('saves the reason-chip message without taking back the approval', async () => {
    const q = await a.createQuestion('surfing');
    if (!q.ok) throw new Error('create failed');
    await a.setQuestionApproval('surfing', q.question.key, true);
    const r = await a.updateQuestion('surfing', q.question.key, { missMessage: 'Water colder than your limit' });
    expect(r.ok && r.question.missMessage).toBe('Water colder than your limit');
    expect(r.ok && r.approvalCleared).toBe(false);
    expect((await a.updateQuestion('surfing', q.question.key, { missMessage: 'x'.repeat(61) })).ok).toBe(false);
  });

  it('keeps proposed links apart until accepted: accepting leaves the approval alone, other changes take it back', async () => {
    const dbx = h.db as ReturnType<typeof drizzle<typeof schema>>;
    await dbx.insert(schema.interestChips).values([{ interestKey: 'cyclingRoad', chipKey: 'touring', label: 'Multi-day touring' }, { interestKey: 'cyclingRoad', chipKey: 'gravel', label: 'Gravel' }]);
    const q = await a.createQuestion('cyclingRoad');
    if (!q.ok) throw new Error('create failed');
    await a.setQuestionApproval('cyclingRoad', q.question.key, true);
    await dbx.insert(schema.interestQuestionChips).values([{ interestKey: 'cyclingRoad', questionKey: q.question.key, chipKey: 'touring', suggested: true }, { interestKey: 'cyclingRoad', questionKey: q.question.key, chipKey: 'gravel', suggested: true }]);
    // a proposal is not a link
    const rules = await import('@/lib/onboarding/question-rules');
    expect(rules.isQuestionAsked({ key: q.question.key, whenChips: [] }, [], [])).toBe(true);
    // accepting one keeps the approval
    const acc = await a.setQuestionChipLink('cyclingRoad', q.question.key, 'touring', true);
    expect(acc.ok && acc.question.whenChips).toEqual(['touring']);
    expect(acc.ok && acc.question.suggestedChips).toEqual(['gravel']);
    expect(acc.ok && acc.approvalCleared).toBe(false);
    expect(acc.ok && acc.question.approvedAt).toBeTruthy();
    // dismissing the other proposal keeps it too
    const dis = await a.setQuestionChipLink('cyclingRoad', q.question.key, 'gravel', false);
    expect(dis.ok && dis.question.suggestedChips).toEqual([]);
    expect(dis.ok && dis.approvalCleared).toBe(false);
    // adding a link by hand changes who is asked: approval goes
    const added = await a.setQuestionChipLink('cyclingRoad', q.question.key, 'gravel', true);
    expect(added.ok && added.question.whenChips).toEqual(['gravel', 'touring']);
    expect(added.ok && added.approvalCleared).toBe(true);
  });

  it('accepts or dismisses all proposals for a question or an interest', async () => {
    const dbx = h.db as ReturnType<typeof drizzle<typeof schema>>;
    const q1 = await a.createQuestion('hiking');
    const q2 = await a.createQuestion('hiking');
    if (!q1.ok || !q2.ok) throw new Error('create failed');
    await dbx.insert(schema.interestChips).values([{ interestKey: 'hiking', chipKey: 'sugg-hut', label: 'Hut-to-hut' }, { interestKey: 'hiking', chipKey: 'sugg-multi', label: 'Multi-day treks' }]);
    await dbx.insert(schema.interestQuestionChips).values([
      { interestKey: 'hiking', questionKey: q1.question.key, chipKey: 'sugg-hut', suggested: true },
      { interestKey: 'hiking', questionKey: q2.question.key, chipKey: 'sugg-multi', suggested: true },
    ]);
    expect((await a.dismissSuggestedLinks('hiking', q1.question.key)).ok).toBe(true);
    const left = await dbx.select().from(schema.interestQuestionChips).where(eq(schema.interestQuestionChips.interestKey, 'hiking'));
    expect(left.map((r) => r.questionKey)).toEqual([q2.question.key]);
    const acc = await a.acceptSuggestedLinks('hiking', null);
    expect(acc.ok && acc.changed).toBe(1);
    const after = await dbx.select().from(schema.interestQuestionChips).where(eq(schema.interestQuestionChips.interestKey, 'hiking'));
    expect(after.every((r) => r.suggested === false)).toBe(true);
    expect((await a.acceptSuggestedLinks('hiking', null)).ok && 0).toBe(0);
  });
});
