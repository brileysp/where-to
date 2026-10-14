import { describe, expect, it } from 'vitest';
import { isNotApplicable, validateContent, overallStatus } from '../../src/lib/gemini/validate';
import type { GenerationOutput } from '../../src/lib/gemini/schema';

const na = (overview: string, score = 0, text = 'n/a'): GenerationOutput => ({
  overview,
  monthly: Array.from({ length: 12 }, () => ({ score, text })),
  sources: [],
  confidence: 'high',
  flags: [],
});

describe('NOT_APPLICABLE convention', () => {
  it('accepts a well-formed not-applicable output and flags it for a human glance', () => {
    const out = na('NOT_APPLICABLE: Landlocked, no river dolphins, and the nearest sea is more than a day away.');
    expect(isNotApplicable(out)).toBe(true);
    const issues = validateContent(out, 'whaleWatching', 'kyrgyzstan');
    expect(overallStatus(issues)).toBe('valid');
    expect(issues.some((i) => i.severity === 'warning' && /not applicable/i.test(i.message))).toBe(true);
  });

  it('rejects a missing reason', () => {
    expect(overallStatus(validateContent(na('NOT_APPLICABLE:'), 'whaleWatching', 'x'))).toBe('invalid');
  });

  it('rejects nonzero scores or real month text under the marker', () => {
    expect(overallStatus(validateContent(na('NOT_APPLICABLE: Landlocked and far from any sea or river dolphins.', 1.2), 'whaleWatching', 'x'))).toBe('invalid');
    expect(overallStatus(validateContent(na('NOT_APPLICABLE: Landlocked and far from any sea or river dolphins.', 0, 'Whales pass offshore.'), 'whaleWatching', 'x'))).toBe('invalid');
  });

  it('does not treat ordinary text as not applicable', () => {
    expect(isNotApplicable(na('Humpback whales pass offshore during the winter migration.'))).toBe(false);
  });
});

describe('whale watching overview ceiling', () => {
  const mk = (overview: string, peak: number): GenerationOutput => ({
    overview,
    monthly: Array.from({ length: 12 }, (_, i) => ({ score: i === 5 ? peak : 1, text: i === 5 ? 'Humpback whales feed off the coast in summer.' : `Quiet month ${i}, humpback whales are absent from the coast.` })),
    sources: [],
    confidence: 'high',
    flags: [],
  });
  it('rejects an overview over its ceiling for whale watching but only warns for other interests', () => {
    const long = 'Humpback whales feed off the coast. '.repeat(10); // 360 chars, ceiling is 280 for a peak under 4
    const whale = validateContent(mk(long, 3.2), 'whaleWatching', 'x');
    expect(whale.some((i) => i.severity === 'reject' && /blurb_overall/.test(i.message))).toBe(true);
    const birding = validateContent(mk(long, 3.2), 'birding', 'x');
    expect(birding.some((i) => i.severity === 'reject' && /blurb_overall/.test(i.message))).toBe(false);
    expect(birding.some((i) => i.severity === 'warning' && /blurb_overall/.test(i.message))).toBe(true);
  });
});
