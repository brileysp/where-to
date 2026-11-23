// 13 Nov 2026: the month scores that are live for one interest (every place with an authored curve that is not marked N/A, written text or not), as twelve-number series, for the last-digit gate.
// Every path that writes scores compares what it is about to save against these (src/lib/gemini/even-tenths.ts: balanceAgainstLive / assertEvenTenths).
import { scorePlace } from '@/lib/db/queries/places';

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Live monthly scores of one interest; places in `exclude` (the ones about to be rewritten) are left out so they are not counted twice. */
export function liveSeries(rows: Array<{ id: string; authoredCurves?: string[] | null; naSliders?: string[] | null }>, interestKey: string, exclude: Set<string> = new Set()): number[][] {
  const out: number[][] = [];
  for (const r of rows) {
    if (exclude.has(r.id)) continue;
    if (!(r.authoredCurves ?? []).includes(interestKey) || (r.naSliders ?? []).includes(interestKey)) continue;
    const m = ((scorePlace(r as never) as unknown as { monthly: Record<string, number[]> }).monthly ?? {})[interestKey];
    if (m && m.length === 12) out.push(m.map(r1));
  }
  return out;
}
