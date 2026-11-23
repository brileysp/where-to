// 13 Nov 2026: the month blurb groups are decided by CODE from the twelve month scores, not by Gemini (owner's rules, same day): a group is a run of NEIGHBORING months
// (December and January are neighbors), closed months stand apart, and the scores inside one group stay within 0.5 points, or within 1.0 when they only climb or only fall
// (a curve a reader expects). Gemini then writes one blurb per group it is handed. Why: left to choose, Gemini grouped months by level word (peak with peak, however far
// apart) and could not check twelve numbers against its own grouping (practice batch two, 13 Nov 2026).

export interface MonthGroup {
  /** Month numbers 1 to 12, in calendar order from the first month of the stretch (so 11, 12, 1, 2 is one group). */
  months: number[];
  min: number;
  max: number;
  level: 'peak' | 'good' | 'fair' | 'poor' | 'closed';
}

const TOL = 0.5; // a group may span this many points
const SMOOTH_TOL = 1.0; // ...or this many if the scores only climb or only fall through it
const SLACK = 0.05; // rounding noise allowed in "only climbs" / "only falls"

export const CLOSED_BELOW = 0.05;

/** How good a month is relative to the best month of this place (the prompt's own definition of the level word). */
export function levelFor(score: number, best: number): MonthGroup['level'] {
  if (score < CLOSED_BELOW) return 'closed';
  const r = best > 0 ? score / best : 0;
  return r >= 0.93 ? 'peak' : r >= 0.75 ? 'good' : r >= 0.5 ? 'fair' : 'poor';
}

function monotone(v: number[]): boolean {
  const up = v.every((x, i) => i === 0 || x >= v[i - 1] - SLACK);
  const down = v.every((x, i) => i === 0 || x <= v[i - 1] + SLACK);
  return up || down;
}

/** True when these scores may share a blurb. */
export function fitsOneGroup(v: number[]): boolean {
  const spread = Math.max(...v) - Math.min(...v);
  return spread <= TOL + 1e-9 || (spread <= SMOOTH_TOL + 1e-9 && monotone(v));
}

/** Groups the twelve scores (January first) into runs of neighboring months. */
export function groupMonths(scores: number[]): MonthGroup[] {
  if (scores.length !== 12) throw new Error('groupMonths needs twelve scores');
  const s = scores.map((x) => Math.round(x * 10) / 10);
  const best = Math.max(...s);
  const closed = s.map((x) => x < CLOSED_BELOW);
  const out: MonthGroup[] = [];
  // Start where the biggest step between neighbors is, so the wrap from December to January does not cut a run in two for no reason.
  let start = 0, bigStep = -1;
  for (let i = 0; i < 12; i++) {
    const prev = (i + 11) % 12;
    const step = closed[i] !== closed[prev] ? 1000 : Math.abs(s[i] - s[prev]);
    if (step > bigStep + 1e-9) { bigStep = step; start = i; }
  }
  let i = 0;
  while (i < 12) {
    const first = (start + i) % 12;
    const run = [first];
    let j = i + 1;
    while (j < 12) {
      const m = (start + j) % 12;
      if (closed[m] !== closed[first]) break;
      const vals = [...run, m].map((x) => s[x]);
      if (closed[first]) { run.push(m); j++; continue; } // closed months are all 0: one group
      if (!fitsOneGroup(vals)) break;
      run.push(m); j++;
    }
    const vals = run.map((x) => s[x]);
    out.push({ months: run.map((x) => x + 1), min: Math.min(...vals), max: Math.max(...vals), level: closed[first] ? 'closed' : levelFor(Math.max(...vals), best) });
    i += run.length;
  }
  return out;
}

/** "November to March" style text for the prompt: the months of a group as names. */
const NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function describeMonths(months: number[]): string {
  return months.length === 1 ? NAMES[months[0] - 1] : months.length === 2 ? `${NAMES[months[0] - 1]} and ${NAMES[months[1] - 1]}` : `${NAMES[months[0] - 1]} to ${NAMES[months[months.length - 1] - 1]}`;
}
