import { describe, expect, it } from 'vitest';
import { claimKinds, extractClaims, hashSentence, namedThings, splitSentences } from '../../src/lib/gemini/claims';
import type { GenerationOutput } from '../../src/lib/gemini/schema';

describe('claim extraction', () => {
  it('flags the Sedona sentence that invented loops: named route, a distance, a plural claim', () => {
    const k = claimKinds('Trails range from easy 2-mile loops around Bell Rock to strenuous climbs up Cathedral Rock.', 'Sedona');
    expect(k.kinds).toEqual(expect.arrayContaining(['named', 'number', 'plural']));
    expect(k.entities).toEqual(['Bell Rock', 'Cathedral Rock']);
  });
  it('separates names at commas and "and", and ignores the place\'s own name and months', () => {
    expect(namedThings('Tre Cime, Seceda and Lago di Braies draw the summer crowds.', 'Dolomites')).toEqual(['Tre Cime', 'Seceda', 'Lago di Braies']);
    expect(namedThings('Sedona is best in March and April.', 'Sedona')).toEqual([]);
  });
  it('flags numbers with units, access claims, superlatives and climate claims, not generic scenery', () => {
    expect(claimKinds('The 75-mile Alta Via 1 takes 10 to 13 days.', 'Dolomites').kinds).toEqual(expect.arrayContaining(['named', 'number']));
    expect(claimKinds('Most cable cars and mountain huts are shut for the mud season.', 'Dolomites').kinds).toContain('access');
    expect(claimKinds('It is the longest day hike in the park.', 'X').kinds).toContain('superlative');
    expect(claimKinds('July is the wettest month, with highs in the 60s.', 'X').kinds).toContain('climate');
    expect(claimKinds('Sweeping views reward the effort in the cool air.', 'X').kinds).toEqual([]);
  });
  it('merges a sentence shared by several months and keeps a stable hash', () => {
    const m = (text: string) => ({ score: 5, text });
    const out = { overview: 'Easy walk.', monthly: [m('Deep snow shuts the huts.'), m('Deep snow shuts the huts.'), ...Array.from({ length: 10 }, () => m('Quiet.'))] } as unknown as GenerationOutput;
    const claims = extractClaims(out, 'Somewhere');
    expect(claims).toHaveLength(1);
    expect(claims[0].where).toEqual(['jan', 'feb']);
    expect(hashSentence('Deep  snow shuts the HUTS.')).toBe(hashSentence('deep snow shuts the huts.'));
  });
  it('splits sentences without breaking numbers', () => {
    expect(splitSentences('It is 6,110 ft high. Start early.')).toEqual(['It is 6,110 ft high.', 'Start early.']);
  });
});
