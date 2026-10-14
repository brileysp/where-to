import { describe, it, expect } from 'vitest';
import { birdingCountScore, birdingModel } from '@/lib/scoring/birdingModel';

describe('birdingModel', () => {
  it('maps the species curve onto 0-10 between 40 and 1,600', () => {
    expect(birdingCountScore(40)).toBeCloseTo(0, 5);
    expect(birdingCountScore(1600)).toBeCloseTo(10, 5);
    expect(birdingCountScore(10)).toBe(0);
    expect(birdingCountScore(5000)).toBe(10);
  });

  it('puts Colombian Andes inputs at the 10.0 ceiling', () => {
    const r = birdingModel({ species: 1000, endemism: 9, charisma: 10, spectacle: 3, lineage: 2 });
    expect(r.count).toBeCloseTo(8.73, 1);
    expect(r.score).toBe(10);
    expect(r.capped).toBe(true);
  });

  it('does not let spectacle carry a short list (Falklands)', () => {
    const r = birdingModel({ species: 60, endemism: 6, charisma: 10, spectacle: 10, lineage: 3 });
    expect(r.score).toBeCloseTo(6.1, 1);
    expect(r.capped).toBe(false);
  });
});
