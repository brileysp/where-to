import { describe, expect, it } from 'vitest';
import { birdCaseProblems } from '@/lib/text/species-case';
import { BIRD_NAMES } from '@/lib/text/bird-names';

describe('birdCaseProblems', () => {
  it('has a list of known names', () => {
    expect(BIRD_NAMES.length).toBeGreaterThan(100);
    expect(BIRD_NAMES).toContain('Atlantic Puffin');
  });
  it('accepts correctly capitalized names, singular, plural and marked', () => {
    expect(birdCaseProblems('Atlantic Puffin colonies are busy; thousands of Atlantic Puffins nest here.')).toEqual([]);
    expect(birdCaseProblems('Look for **Atlantic Puffin** on the cliffs.')).toEqual([]);
  });
  it('flags a known bird in the wrong casing and says how it should read', () => {
    expect(birdCaseProblems('Colonies of atlantic puffin line the cliffs.')).toEqual([{ found: 'atlantic puffin', expected: 'Atlantic Puffin' }]);
    expect(birdCaseProblems('Atlantic puffins arrive in April.')).toEqual([{ found: 'Atlantic puffin', expected: 'Atlantic Puffin' }]);
  });
  it('does not match inside longer words or other names', () => {
    expect(birdCaseProblems('The Andean Condor soars; an andean condorito is not a thing here.')).toEqual([]);
  });
  it('leaves other animals and ordinary text alone', () => {
    expect(birdCaseProblems('Humpback whales and mountain gorillas are the draw.')).toEqual([]);
  });
});
