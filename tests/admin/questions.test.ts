import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'path';
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
});
