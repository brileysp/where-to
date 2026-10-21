import { describe, it, expect, beforeAll, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import path from 'node:path';
import * as schema from '@/lib/db/schema';

const h = vi.hoisted(() => ({ db: null as unknown }));
vi.mock('@/lib/db/client', () => ({
  get db() {
    return h.db;
  },
}));

describe('the suggested links review', () => {
  let q: typeof import('@/lib/db/queries/question-links');
  beforeAll(async () => {
    const db = drizzle(new PGlite(), { schema });
    h.db = db;
    await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
    await db.insert(schema.interestChips).values([
      { interestKey: 'skiingSnowboarding', chipKey: 'resort', label: 'Downhill resort skiing', sortOrder: 1 },
      { interestKey: 'skiingSnowboarding', chipKey: 'xc', label: 'Cross-country skiing', sortOrder: 2 },
      { interestKey: 'streetFood', chipKey: 'night', label: 'Night markets', sortOrder: 1 },
    ]);
    await db.insert(schema.interestQuestions).values([
      { interestKey: 'skiingSnowboarding', questionKey: 'q1', text: 'What is your level?', options: ['a', 'b'], sortOrder: 1 },
      { interestKey: 'skiingSnowboarding', questionKey: 'q3', text: 'Skis or snowboard?', options: ['a', 'b'], sortOrder: 2 },
      { interestKey: 'streetFood', questionKey: 'q1', text: 'How do you like to eat street food?', options: ['a', 'b'], sortOrder: 1 },
      { interestKey: 'streetFood', questionKey: 'q2', text: 'How careful about hygiene?', options: ['a', 'b'], sortOrder: 2 },
    ]);
    await db.insert(schema.interestQuestionChips).values([
      { interestKey: 'skiingSnowboarding', questionKey: 'q3', chipKey: 'resort', suggested: true },
      { interestKey: 'streetFood', questionKey: 'q1', chipKey: 'night', suggested: true },
      { interestKey: 'streetFood', questionKey: 'q2', chipKey: 'night', suggested: false },
    ]);
    q = await import('@/lib/db/queries/question-links');
  });

  it('counts the proposals, not the accepted links', async () => {
    expect(await q.getSuggestedLinkCount()).toBe(2);
  });

  it('lists only the questions with a proposal, grouped by interest, with all of that interest\'s chips', async () => {
    const r = await q.getSuggestedLinkReview();
    expect(r.total).toBe(2);
    expect(r.interests.map((i) => i.key)).toEqual(['skiingSnowboarding', 'streetFood']); // by label: Skiing & Snowboarding, Street Food
    const ski = r.interests[0];
    expect(ski.questions.map((x) => x.text)).toEqual(['Skis or snowboard?']);
    expect(ski.questions[0].suggestedChips).toEqual(['resort']);
    expect(ski.questions[0].whenChips).toEqual([]);
    expect(ski.chips.map((c) => c.label)).toEqual(['Downhill resort skiing', 'Cross-country skiing']);
    const food = r.interests[1];
    expect(food.questions.map((x) => x.key)).toEqual(['q1']);
  });
});
