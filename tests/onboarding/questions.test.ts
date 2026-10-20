import { describe, it, expect, vi } from 'vitest';
import type { DnaCard } from '@/lib/dna/types';
import { laneInterests, pickQuestion, questionQuotas } from '@/lib/onboarding/questions';

// A stand-in ranking so the picking logic runs without the full place data.
vi.mock('@/lib/onboarding/shortlist', async (orig) => {
  const real = await orig<typeof import('@/lib/onboarding/shortlist')>();
  return { ...real, rankPlaces: () => [{ d: { id: 'a' }, s: 3 }, { d: { id: 'b' }, s: 2 }, { d: { id: 'c' }, s: 1 }] };
});

const card = (id: string, category: string): DnaCard =>
  ({ id, short: id, title: id, description: '', category, tags: [], preferenceSignals: {}, dimensionSignals: {}, stage: 'broad', domain: null, niche: false, subdimensions: null, sampleDestinations: null, unlockMinPositive: null, unlockMinLove: null, diagnosticPurpose: null }) as DnaCard;

describe('sharing the ten questions across the top interests', () => {
  it('splits ten evenly, the first interests getting the extra one', () => {
    expect(questionQuotas(5, 10)).toEqual([2, 2, 2, 2, 2]);
    expect(questionQuotas(4, 10)).toEqual([3, 3, 2, 2]);
    expect(questionQuotas(3, 10)).toEqual([4, 3, 3]);
    expect(questionQuotas(2, 10)).toEqual([5, 5]);
    expect(questionQuotas(1, 10)).toEqual([10]);
    expect(questionQuotas(0, 10)).toEqual([]);
  });
  it('asks about the Top interests; with none, the Love ones, then Like, never more than five', () => {
    expect(laneInterests({ hiking: 'top', golf: 'like', surfing: 'top' })).toEqual(['hiking', 'surfing']);
    expect(laneInterests({ hiking: 'love', golf: 'like' })).toEqual(['hiking']);
    expect(laneInterests({ hiking: 'like', golf: 'like', surfing: 'like', diving: 'like', birding: 'like', safari: 'like' })).toHaveLength(5);
    expect(laneInterests({})).toEqual([]);
  });
});

describe('the questions come in groups, one interest at a time', () => {
  const cards = [
    ...['h1', 'h2', 'h3', 'h4'].map((id) => card(id, 'Hiking')),
    ...['s1', 's2', 's3', 's4'].map((id) => card(id, 'Surfing')),
    ...['g1', 'g2'].map((id) => card(id, 'Golf')),
    card('x1', 'Beach'),
  ];
  const base = { cards, destinations: [], month: 5 };
  const ask = (levels: Record<string, 'top' | 'like'>, asked: string[]) =>
    pickQuestion({ ...base, input: { levels, who: [], bands: {}, vibes: [], answers: [] }, seenCardIds: asked, askedCardIds: asked });

  it('two top interests get five questions each, the first interest completely before the second starts', () => {
    const levels = { hiking: 'top', surfing: 'top' } as const;
    const asked: string[] = [];
    const seq: Array<{ interest?: string; n?: number }> = [];
    for (let i = 0; i < 8; i++) {
      const q = ask({ ...levels }, asked);
      if (!q) break;
      seq.push({ interest: q.interest, n: q.position?.n });
      asked.push(q.card.id);
    }
    // Hiking has four cards, so its fifth slot moves on to surfing; surfing then fills.
    expect(seq.slice(0, 4).every((s) => s.interest === 'hiking')).toBe(true);
    expect(seq.slice(0, 4).map((s) => s.n)).toEqual([1, 2, 3, 4]);
    expect(seq[4].interest).toBe('surfing');
  });
  it('three top interests: 4, 3, 3, in order, and each question says where it is in its group', () => {
    const levels = { hiking: 'top', surfing: 'top', golf: 'top' } as const;
    const first = ask({ ...levels }, []);
    expect(first!.interest).toBe('hiking');
    expect(first!.position).toEqual({ n: 1, of: 4 });
    const afterHiking = ask({ ...levels }, ['h1', 'h2', 'h3', 'h4']);
    expect(afterHiking!.interest).toBe('surfing');
    expect(afterHiking!.position).toEqual({ n: 1, of: 3 });
    const afterSurfing = ask({ ...levels }, ['h1', 'h2', 'h3', 'h4', 's1', 's2', 's3']);
    expect(afterSurfing!.interest).toBe('golf');
  });
  it('a skipped question counts as asked, and does not come back', () => {
    const q = pickQuestion({ ...base, input: { levels: { hiking: 'top' }, who: [], bands: {}, vibes: [], answers: [] }, seenCardIds: ['h1'], askedCardIds: ['h1'] });
    expect(q!.card.id).not.toBe('h1');
    expect(q!.position).toEqual({ n: 2, of: 10 });
  });
  it('after every group is done the picker carries on as before', () => {
    const q = ask({ hiking: 'top' }, ['h1', 'h2', 'h3', 'h4', 'x']);
    expect(q?.interest).toBeUndefined();
  });
});
