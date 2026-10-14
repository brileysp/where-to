import { describe, expect, it } from 'vitest';
import { baseVersion, planPasses, totalTokens, type BatchSummary } from '@/lib/gemini/passes';

const day = (d: number, h = 0) => new Date(Date.UTC(2026, 9, d, h));
const batch = (over: Partial<BatchSummary> & { id: string }): BatchSummary => ({
  interestKey: 'diving', startedAt: day(9), finishedAt: day(9, 1), generations: 20, tokensIn: 1000, tokensOut: 500, costUsd: 0.5,
  versions: ['diving/v7'], placeIds: Array.from({ length: 20 }, (_, i) => `${over.id}-${i}`), appliedCount: 0, lastActivity: day(9, 1), ...over,
});

describe('authoring passes', () => {
  it('strips the note after a prompt version', () => {
    expect(baseVersion('whaleWatching/v2 (adapted by Claude from the Hudson Valley text)')).toBe('whaleWatching/v2');
  });
  it('groups batches by interest and prompt version, leaves out empty runs, and labels them', () => {
    const plan = planPasses(
      [batch({ id: 'a' }), batch({ id: 'b', startedAt: day(10), lastActivity: day(10, 2) }), batch({ id: 'e', generations: 0, versions: [] }), batch({ id: 'c', versions: ['diving/v3'], startedAt: day(8), lastActivity: day(8, 1), placeIds: ['x', 'y'], generations: 2 })],
      () => 'Snorkeling & Diving',
    );
    expect(plan.map((p) => p.label)).toEqual(['Snorkeling & Diving · v3', 'Snorkeling & Diving · v7']);
    expect(plan[0].kind).toBe('pilot'); // 2 places
    expect(plan[1].kind).toBe('initial');
    expect(plan[1].batchIds.sort()).toEqual(['a', 'b']);
  });
  it('leaves the newest unapplied full pass in progress and finishes everything else at its last activity', () => {
    const plan = planPasses(
      [batch({ id: 'old', versions: ['birding/v1'], interestKey: 'birding', appliedCount: 20, startedAt: day(2), lastActivity: day(3) }), batch({ id: 'new', versions: ['birding/v2'], interestKey: 'birding', startedAt: day(5), lastActivity: day(5, 3) })],
      () => 'Birding',
    );
    expect(plan.find((p) => p.label === 'Birding · v1')?.finishedAt?.toISOString()).toBe(day(3).toISOString());
    expect(plan.find((p) => p.label === 'Birding · v2')?.finishedAt).toBeNull();
    expect(plan.find((p) => p.label === 'Birding · v2')?.kind).toBe('redo');
  });
  it('treats a batch with results but no model spend as hand edits', () => {
    const plan = planPasses([batch({ id: 'm', interestKey: 'whaleWatching', versions: ['whaleWatching/v2'], tokensIn: 0, tokensOut: 0, costUsd: 0, appliedCount: 20 })], () => 'Whale Watching');
    expect(plan[0].kind).toBe('targeted');
    expect(plan[0].label).toContain('source-check edits');
  });
  it('adds input and output tokens', () => {
    expect(totalTokens(1000, 500)).toBe(1500);
  });
});
