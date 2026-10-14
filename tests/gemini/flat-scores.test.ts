import { describe, expect, it } from 'vitest';
import { flatScoresIfSingleBlurb } from '@/lib/gemini/decimalize';

describe('flat scores for a single blurb', () => {
  it('flattens twelve identical blurbs to one score', () => {
    const texts = Array(12).fill('Chance sightings all year.');
    const out = flatScoresIfSingleBlurb(texts, [0.9, 1, 1.1, 0.8, 1.1, 1, 1.1, 0.8, 1, 0.9, 1, 0.9]);
    expect(out).toEqual(Array(12).fill(1));
  });
  it('does nothing when any month has its own blurb', () => {
    const texts = Array(12).fill('Chance sightings all year.');
    texts[6] = 'Chance sightings, and monsoon rain makes boats less pleasant.';
    expect(flatScoresIfSingleBlurb(texts, Array(12).fill(1))).toBeNull();
  });
});

describe('flat stretches stay flat, slopes may differ', () => {
  const closed = 'Near-freezing water stops dive charters.';
  it('keeps a stretch the model scored equal exactly equal', async () => {
    const { holdFlatMonths, decimalizeScores } = await import('@/lib/gemini/decimalize');
    const texts = [closed, closed, closed, 'Thaw.', 'May.', 'June.', 'July.', 'July.', 'July.', 'Oct.', 'Nov.', closed];
    const raw = [0.5, 0.5, 0.5, 1.5, 2.5, 3.5, 4, 4, 4, 2.5, 1, 0.5];
    const out = holdFlatMonths(texts, raw, decimalizeScores(raw, 'chicago'));
    expect([out[0], out[1], out[2], out[11]]).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect([out[6], out[7], out[8]]).toEqual([4, 4, 4]);
  });
  it('flattens identical text at the bottom of the year even when raw scores wobble', async () => {
    const { holdFlatMonths } = await import('@/lib/gemini/decimalize');
    const texts = [closed, closed, closed, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', closed];
    const raw = [0.7, 0.5, 0.7, 1.5, 2.5, 3.5, 4, 4.2, 3.5, 2.5, 1, 0.6];
    const out = holdFlatMonths(texts, raw, raw);
    expect(new Set([out[0], out[1], out[2], out[11]]).size).toBe(1);
  });
  it('leaves a slope with identical text alone', async () => {
    const { holdFlatMonths } = await import('@/lib/gemini/decimalize');
    const same = 'Water warms steadily.';
    const texts = ['a', 'b', 'c', same, same, 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const raw = [0.5, 1, 2, 4.4, 4.7, 6, 7, 6, 5, 3, 2, 1];
    const spread = raw.slice();
    const out = holdFlatMonths(texts, raw, spread);
    expect(out[3]).toBe(4.4);
    expect(out[4]).toBe(4.7);
  });
});

describe('condition levels', () => {
  it('turns levels into scores from the peak, with closed as one flat floor', async () => {
    const { scoresFromLevels } = await import('@/lib/gemini/condition-levels');
    expect(scoresFromLevels(9, ['peak', 'strong', 'reduced', 'poor', 'disrupted', 'closed'])).toEqual([9, 8.3, 7.2, 5.9, 3.2, 0.4]);
    expect(scoresFromLevels(4, ['closed', 'closed', 'closed'])).toEqual([0.4, 0.4, 0.4]);
  });
});

describe('smoothing blocky scores', () => {
  it('leaves an already varied year and a flat year alone', async () => {
    const { smoothBlockyScores, isBlocky } = await import('@/lib/gemini/smooth-scores');
    const varied = [7.8, 7.7, 7.5, 6.8, 5.5, 4.5, 4.6, 4.8, 5.6, 6.5, 7.2, 7.6];
    expect(isBlocky(varied)).toBe(false);
    expect(smoothBlockyScores(varied)).toEqual(varied);
    const flat = Array(12).fill(5);
    expect(smoothBlockyScores(flat)).toEqual(flat);
  });
  it('turns a staircase into a slope without moving the peak or closed months', async () => {
    const { smoothBlockyScores, isBlocky } = await import('@/lib/gemini/smooth-scores');
    const raw = [9.5, 9.5, 9.5, 9.2, 9.2, 8.5, 8, 7.5, 7.5, 8.5, 9, 9.5];
    expect(isBlocky(raw)).toBe(true);
    const out = smoothBlockyScores(raw);
    expect(Math.max(...out)).toBe(9.5);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(7.5);
    out.forEach((v, i) => expect(Math.abs(v - raw[i])).toBeLessThanOrEqual(0.71));
    // fewer repeated neighbours than before
    const repeats = (a: number[]) => a.filter((v, i) => Math.abs(v - a[(i + 1) % 12]) < 0.05).length;
    expect(repeats(out)).toBeLessThan(repeats(raw));
    const closed = [0.5, 0.5, 0.5, 1.5, 2.5, 3.5, 4, 4, 4, 2.5, 1, 0.5];
    const c = smoothBlockyScores(closed);
    expect([c[0], c[1], c[2], c[11]]).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(Math.max(...c)).toBe(4);
  });
  it('keeps a real dip between two highs', async () => {
    const { smoothBlockyScores } = await import('@/lib/gemini/smooth-scores');
    const out = smoothBlockyScores([6.5, 6.5, 7.5, 8.2, 8.2, 7.5, 7.5, 8.3, 8.3, 8.5, 8, 6.5]);
    expect(out[5]).toBeLessThan(out[4]);
    expect(out[6]).toBeLessThan(out[8]);
    expect(Math.max(...out)).toBe(8.5);
  });
});

describe('smoothing respects intended steps', () => {
  it('keeps an arrival that stays (May, then August) and ramps inside each stretch', async () => {
    const { smoothBlockyScores } = await import('@/lib/gemini/smooth-scores');
    const raw = [8, 8, 8, 8, 9, 9, 9, 9.5, 9.5, 9.5, 8, 8];
    const texts = ['wet', 'wet', 'wet', 'wet', 'dry', 'dry', 'dry', 'whales', 'whales', 'whales', 'wet', 'wet'];
    const out = smoothBlockyScores(raw, texts);
    expect(out[4]).toBeGreaterThanOrEqual(8.8); // May's arrival is not smeared back toward 8
    expect(out[3]).toBe(8); // and April stays where it was
    expect(out[5]).toBeGreaterThan(out[4]);
    expect(out[6]).toBeGreaterThan(out[5]);
    expect(out[7]).toBeGreaterThan(out[6]); // no bump above the August level
    expect(out[10]).toBe(8);
  });
});

describe('smoother guard rails found on the whale data', () => {
  it('leaves a long off-season floor that wobbles by a tenth exactly as written', async () => {
    const { smoothBlockyScores } = await import('@/lib/gemini/smooth-scores');
    const maui = [9.6, 10, 10, 7.9, 3.8, 2.0, 1.8, 1.8, 1.9, 1.9, 4.5, 7.0];
    expect(smoothBlockyScores(maui)).toEqual(maui);
  });
  it('never moves a month more than 0.7 whatever the repair steps do', async () => {
    const { smoothBlockyScores } = await import('@/lib/gemini/smooth-scores');
    const cases = [
      [6.5, 6.7, 6.2, 4.6, 3.3, 3.3, 3.3, 3.3, 3.4, 3.4, 3.4, 5.0],
      [9.5, 9.5, 9.5, 9.2, 9.2, 8.5, 8, 7.5, 7.5, 8.5, 9, 9.5],
      [6.5, 6.5, 7.5, 8.2, 8.2, 7.5, 7.5, 8.3, 8.3, 8.5, 8, 6.5],
    ];
    for (const raw of cases) smoothBlockyScores(raw).forEach((v, i) => expect(Math.abs(v - raw[i])).toBeLessThanOrEqual(0.71));
  });
  it('does not call a peak slab on its own blocky', async () => {
    const { isBlocky } = await import('@/lib/gemini/smooth-scores');
    expect(isBlocky([2.5, 2.5, 2.5, 1.9, 1.2, 0.6, 0.5, 0.3, 0.9, 1.4, 2.0, 2.5])).toBe(false);
  });
});

describe('gently varying years and steady stretches', () => {
  it('eases a three-step year that only spans one point', async () => {
    const { smoothBlockyScores, isBlocky } = await import('@/lib/gemini/smooth-scores');
    const raw = [7.5, 7.5, 7.5, 7, 6.5, 6.5, 6.5, 6.5, 6.5, 7, 7, 7.5];
    expect(isBlocky(raw)).toBe(true);
    const out = smoothBlockyScores(raw);
    const repeatsOutsideFloor = out.filter((v, i) => Math.abs(v - out[(i + 1) % 12]) < 0.05 && v > 6.55).length;
    expect(repeatsOutsideFloor).toBeLessThanOrEqual(1);
    expect(Math.max(...out)).toBe(7.5);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(6.5);
  });
  it('holds a steady stretch flat instead of wobbling it', async () => {
    const { holdFlatBands } = await import('@/lib/gemini/decimalize');
    const raw = [7.5, 7.5, 7.5, 7, 6.5, 6.5, 6.5, 6.5, 6.5, 7, 7, 7.5];
    const wobbled = [7.7, 7.6, 7.4, 7.2, 6.4, 6.5, 6.4, 6.6, 6.7, 7.2, 6.9, 7.6];
    const band = raw.map((v) => v === 6.5);
    const out = holdFlatBands(raw, wobbled, band);
    expect(out.slice(4, 9)).toEqual([6.5, 6.5, 6.5, 6.5, 6.5]);
    expect(out[0]).toBe(7.7);
  });
});

describe('flat bands that sit side by side', () => {
  it('keeps a summer season and a closed winter as two separate bands (Antarctica, 10 Oct 2026)', async () => {
    const { holdFlatBands } = await import('@/lib/gemini/decimalize');
    const { flatBandMonths } = await import('@/lib/gemini/smooth-scores');
    const raw = [7.5, 7.5, 7.5, 0, 0, 0, 0, 0, 0, 0, 7, 7.5];
    const out = holdFlatBands(raw, raw.slice(), flatBandMonths(raw));
    expect(out.slice(3, 10)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(out[0]).toBe(7.5);
    expect(out[11]).toBe(7.5);
  });
});
