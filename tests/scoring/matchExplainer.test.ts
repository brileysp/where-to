import { describe, expect, it } from 'vitest';
import { explainMatch, matchAdjustments } from '@/lib/scoring/matchExplainer';
import { SLIDERS, allBandsSelected } from '@/lib/scoring/constants';
import type { ScoredDestination } from '@/lib/scoring/types';

// Only the fields explainMatch reads.
function dest(scores: Record<string, number>, budgetBands: string[] = ['basic', 'comfortable', 'highend'], costMin = '$'): ScoredDestination {
  const monthly: Record<string, number[]> = {};
  SLIDERS.forEach((s) => (monthly[s.key] = new Array(12).fill(scores[s.key] ?? 0)));
  return {
    monthly, naSliders: [], activityStyleTiers: {}, budgetBands, costRange: { min: costMin, max: '$$$$$' },
    vibeBands: ['easygoing'], physicalBands: ['easy'], weatherBand: new Array(12).fill('warm'),
  } as unknown as ScoredDestination;
}

// A Connoisseur-shaped profile: city/museums high, fishing left at the neutral 2.
const weights: Record<string, number> = {};
SLIDERS.forEach((s) => (weights[s.key] = 2));
Object.assign(weights, { cityExploration: 9, museumsArt: 8, coffeeTea: 5 });

describe('explainMatch — pros only include interests that count', () => {
  it('does not praise a strong interest the user left at the neutral weight', () => {
    // Panama-shaped: weak on the priorities, strong on coffee (weight 5) and fishing (weight 2).
    const e = explainMatch(dest({ coffeeTea: 8, fishing: 8 }), weights, 0, allBandsSelected());
    expect(e.pros.map((p) => p.key)).toEqual(['coffeeTea']);
  });

  it('keeps the unfiltered standouts when the user has stated nothing', () => {
    const e = explainMatch(dest({ fishing: 9 }), {}, 0, allBandsSelected());
    expect(e.pros.map((p) => p.key)).toEqual(['fishing']);
  });
});

describe('explainMatch — budget-friendly pill', () => {
  const cheap = dest({}, ['basic', 'comfortable', 'highend']);
  const bandsWith = (budget: string[]) => ({ ...allBandsSelected(), budget });

  it('shows when only budget is selected, or budget + comfortable', () => {
    for (const sel of [['basic'], ['basic', 'comfortable']]) {
      const e = explainMatch(cheap, weights, 0, bandsWith(sel));
      expect(e.pros.map((p) => p.label)).toContain('Budget-friendly');
    }
  });

  it('does not show when the user only dropped the top tier, or narrowed less than half', () => {
    expect(explainMatch(cheap, weights, 0, bandsWith(['basic', 'comfortable', 'highend'])).pros.map((p) => p.key)).not.toContain('band-budget-match');
    expect(explainMatch(cheap, weights, 0, allBandsSelected()).pros.map((p) => p.key)).not.toContain('band-budget-match');
  });

  it('does not show for a selection that leaves out the cheapest tier (no inverse pill for luxury)', () => {
    for (const sel of [['highend', 'luxury'], ['luxury'], ['comfortable']]) {
      expect(explainMatch(dest({}, ['comfortable', 'highend', 'luxury']), weights, 0, bandsWith(sel)).pros.map((p) => p.key)).not.toContain('band-budget-match');
    }
  });

  it('does not show for a place that lists a budget tier but whose cheapest cost tier is not $ (Rome)', () => {
    const rome = dest({}, ['basic', 'comfortable', 'highend', 'luxury'], '$$');
    expect(explainMatch(rome, weights, 0, bandsWith(['basic'])).pros.map((p) => p.key)).not.toContain('band-budget-match');
  });

  it('does not show for a destination with no budget tier, even when the user selected budget', () => {
    const pricey = dest({}, ['comfortable', 'highend', 'luxury']);
    expect(explainMatch(pricey, weights, 0, bandsWith(['basic'])).pros.map((p) => p.key)).not.toContain('band-budget-match');
  });

  it('leads the pros and leaves room for interest pros', () => {
    const e = explainMatch(dest({ cityExploration: 9, museumsArt: 9, coffeeTea: 9 }), weights, 0, bandsWith(['basic']));
    expect(e.pros[0].label).toBe('Budget-friendly');
    expect(e.pros).toHaveLength(3);
  });
});

describe('matchAdjustments — the note behind the score', () => {
  const bandsWith = (budget: string[]) => ({ ...allBandsSelected(), budget });

  it('is empty when the filters did nothing', () => {
    expect(matchAdjustments(dest({}), 0, allBandsSelected())).toEqual([]);
  });

  it('gives a green reason when the place fits a cost-motivated selection', () => {
    const adj = matchAdjustments(dest({}, ['basic', 'comfortable', 'highend'], '$'), 0, bandsWith(['basic']));
    expect(adj).toEqual([expect.objectContaining({ label: 'Budget-friendly', tone: 'good' })]);
  });

  it('gives a red reason for each dimension the place misses entirely', () => {
    const adj = matchAdjustments(dest({}, ['comfortable', 'highend', 'luxury'], '$$$'), 0, bandsWith(['basic']));
    expect(adj).toEqual([expect.objectContaining({ label: 'Pricier than you want', tone: 'bad' })]);
  });
});
