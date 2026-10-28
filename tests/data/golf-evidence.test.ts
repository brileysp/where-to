import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// The checks docs/column-scoring-plan.md asks for: no gaps, the saved file matches, anchors hold, and the ratings follow the stated formulas.
type Row = Record<string, unknown> & { evidence: Record<string, string> };
const root = join(__dirname, '..', '..');
const evidence = JSON.parse(readFileSync(join(root, 'docs/evidence/golf-evidence.json'), 'utf8')) as Record<string, Row>;
const draft = JSON.parse(readFileSync(join(root, 'scripts/data/golf-facts-draft.json'), 'utf8')) as Record<string, Record<string, unknown>>;
const COLUMNS = ['golfCourses', 'linksGolf', 'bucketListCourses', 'scenicCourses', 'resortCourses', 'courseKinds', 'teeTimeAccess', 'thingsBeyondGolf'];
// Presence-led scale (owner, 28 Oct 2026): one great course can be the reason for the trip.
const presTier = (n: number) => (n === 0 ? 0 : n === 1 ? 7 : n <= 3 ? 8 : n <= 6 ? 9 : 10);
const bucketTier = (n: number) => (n === 0 ? 0 : n === 1 ? 9 : 10);
const num = (text: string, re: RegExp) => Number(re.exec(text)?.[1]);

describe('Golf evidence', () => {
  it('has an evidence line for every place and column (no gaps)', () => {
    expect(Object.keys(evidence)).toHaveLength(182);
    for (const [place, row] of Object.entries(evidence)) for (const col of COLUMNS) expect(row.evidence[col]?.length ?? 0, `${place} ${col}`).toBeGreaterThan(20);
  });
  it('matches what was saved to the facts file', () => {
    for (const [place, row] of Object.entries(evidence)) for (const col of COLUMNS) expect(draft[place][col] ?? null, `${place} ${col}`).toEqual(row[col] ?? null);
  });
  it('keeps the anchors named in the column hints', () => {
    const anchors: Record<string, Record<string, number>> = {
      linksGolf: { 'st-andrews-fife': 10, 'monterey-big-sur': 10, ireland: 9, nyc: 8, amsterdam: 0 },
      bucketListCourses: { 'st-andrews-fife': 10, nyc: 10, rome: 9, paris: 9, algarve: 0 },
    };
    for (const [col, places] of Object.entries(anchors)) for (const [place, want] of Object.entries(places)) expect(evidence[place][col], `${col} ${place}`).toBe(want);
  });
  it('ratings follow the stated count tiers', () => {
    for (const [place, row] of Object.entries(evidence)) {
      const e = row.evidence;
      expect(row.golfCourses, place).toBe(num(e.golfCourses, /^(\d+) golf courses/));
      expect(row.linksGolf, `${place} links`).toBe(Math.max(presTier(num(e.linksGolf, /^(\d+) links course/)), num(e.linksGolf, /of which (\d+) on Wikipedia/) > 0 ? 9 : 0));
      expect(row.scenicCourses, `${place} scenic`).toBe(presTier(num(e.scenicCourses, /^(\d+) scenic course/)));
      expect(row.resortCourses, `${place} resort`).toBe(presTier(num(e.resortCourses, /^(\d+) full-size course/)));
      expect(row.bucketListCourses, `${place} bucket list`).toBe(bucketTier(num(e.bucketListCourses, /^(\d+) venue/)));
    }
  });
  it('things beyond golf is the average of three scores', () => {
    for (const [place, row] of Object.entries(evidence)) {
      const nums = [...row.evidence.thingsBeyondGolf.matchAll(/ (\d+(?:\.\d+)?)(?:,| =)/g)].map((m) => Number(m[1]));
      expect(nums.length, place).toBeGreaterThanOrEqual(3);
      expect(row.thingsBeyondGolf as number, place).toBeCloseTo(Math.round(((nums[0] + nums[1] + nums[2]) / 3) * 10) / 10, 5);
    }
  });
  it('tee-time access is filled only for the six places with a researched famous course', () => {
    const filled = Object.entries(evidence).filter(([, r]) => r.teeTimeAccess).map(([p]) => p).sort();
    expect(filled).toEqual(['edinburgh', 'monterey-big-sur', 'nyc', 'paris', 'rome', 'st-andrews-fife']);
    for (const p of filled) expect(['walkOn', 'weeks', 'months']).toContain(evidence[p].teeTimeAccess);
  });
  it('course kinds are easy, standard or championship', () => {
    for (const row of Object.values(evidence)) for (const k of row.courseKinds as string[]) expect(['easy', 'standard', 'championship']).toContain(k);
  });
});
