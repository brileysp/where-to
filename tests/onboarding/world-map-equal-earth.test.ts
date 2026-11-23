import { describe, it, expect } from 'vitest';
import { buildEqualEarth, equalEarth } from '@/lib/onboarding/world-map-equal-earth';
import { REGION_PATHS } from '@/lib/onboarding/world-map-data';

describe('the Equal Earth world map (owner, 23 Nov 2026: Greenland should not look so huge)', () => {
  it('matches the published projection at its known points', () => {
    expect(equalEarth(0, 0).x).toBeCloseTo(0, 6);
    expect(equalEarth(0, 0).y).toBeCloseTo(0, 6);
    expect(equalEarth(180, 0).x).toBeCloseTo(2.7066, 3);
    expect(equalEarth(0, 90).y).toBeCloseTo(1.3173, 3);
  });
  it('puts the middle of the map in the middle and keeps latitude in order', () => {
    const m = buildEqualEarth(REGION_PATHS, 720);
    const [cx] = m.project(0, 0);
    expect(cx).toBeGreaterThan(320);
    expect(cx).toBeLessThan(360);
    expect(m.project(0, 60)[1]).toBeLessThan(m.project(0, 0)[1]);
    expect(m.project(0, -40)[1]).toBeGreaterThan(m.project(0, 0)[1]);
    expect(m.project(180, 0)[0]).toBeCloseTo(720, 0);
  });
  it('cuts the empty Pacific west of Hawaii (owner, 22 Nov 2026) and is taller than it was', () => {
    const m = buildEqualEarth(REGION_PATHS, 720);
    expect(m.project(-180, 0)[0]).toBe(0);
    // Hawaii (the westernmost land) sits close to the left edge, not about 45 units in as before.
    expect(m.project(-159.8, 22)[0]).toBeGreaterThan(5);
    expect(m.project(-159.8, 22)[0]).toBeLessThan(15);
    // The old map was 720 by about 306 (2.35 to 1); this one shows 88 to -72 degrees.
    expect(720 / m.height).toBeLessThan(2.2);
    expect(m.project(0, 88)[1]).toBeCloseTo(0, 0);
    expect(m.project(0, -72)[1]).toBeCloseTo(m.height, 0);
  });
  it('draws every region again, closed, inside the map', () => {
    const m = buildEqualEarth(REGION_PATHS, 720);
    expect(Object.keys(m.paths).sort()).toEqual(Object.keys(REGION_PATHS).sort());
    for (const d of Object.values(m.paths)) {
      expect(d.startsWith('M')).toBe(true);
      for (const [x, y] of Array.from(d.matchAll(/[ML]([-\d.]+),([-\d.]+)/g)).map((r) => [Number(r[1]), Number(r[2])])) {
        expect(x).toBeGreaterThanOrEqual(-1);
        expect(x).toBeLessThanOrEqual(721);
        expect(y).toBeGreaterThanOrEqual(-1);
        expect(y).toBeLessThanOrEqual(m.height + 1);
      }
    }
  });
  it('shrinks Greenland compared with a plain longitude and latitude map', () => {
    // Greenland's width at 72 degrees north, as a share of the map's width at the equator.
    const m = buildEqualEarth(REGION_PATHS, 720);
    const plain = (60 / 360) * 1; // 60 degrees of longitude at any latitude on a plain grid
    const near = (m.project(-30, 72)[0] - m.project(-60, 72)[0]) / (m.project(180, 0)[0] - m.project(-180, 0)[0]);
    expect(near).toBeLessThan(plain);
  });
});
