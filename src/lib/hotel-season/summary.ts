import { HOLIDAY_POSITIONS, type HotelFlag, type HotelSeasonSummary, type QuoteRun } from './types';

/**
 * Turns one collection run into the small summary a place stores. Pure arithmetic, no database. The same rules the review page used for all 100 places.
 *
 * Index: for each hotel, its own typical price is the median of its prices on the twelve monthly dates (the two holiday dates are left out so a New Year spike cannot move it).
 * A month's index is the median across hotels of price / that hotel's typical price, times 100; null when fewer than 3 hotels had a price.
 */
const median = (a: number[]): number => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const monthOf = (iso: string) => Number(iso.slice(5, 7));
const isHoliday = (i: number) => (HOLIDAY_POSITIONS as readonly number[]).includes(i);
/** December 2026 is the first monthly date, then January to November 2027. */
const calendarOrder = (m: number) => (m === 12 ? 0 : m);
export const MIN_HOTELS_FOR_INDEX = 3;
export const THIN_BELOW = 5;

export function summariseRun(run: QuoteRun): HotelSeasonSummary {
  if (run.dates.length !== 14 || run.listed.length !== 14) throw new Error(`${run.placeId}: a run needs 14 dates and 14 listed counts`);
  const hotels = run.panel.filter((h) => !h.excluded);
  for (const h of hotels) if (h.prices.length !== 14) throw new Error(`${run.placeId}: ${h.name} has ${h.prices.length} prices, not 14`);
  const monthly = run.dates.map((_, i) => i).filter((i) => !isHoliday(i));
  const base = hotels.map((h) => { const v = monthly.map((i) => h.prices[i]).filter((x): x is number => x != null && x > 0); return v.length ? median(v) : null; });
  const idx: Array<number | null> = []; const n: number[] = [];
  for (let i = 0; i < 14; i++) {
    const r: number[] = [];
    hotels.forEach((h, k) => { const p = h.prices[i]; if (p != null && p > 0 && base[k]) r.push(p / (base[k] as number)); });
    n.push(r.length); idx.push(r.length >= MIN_HOTELS_FOR_INDEX ? Math.round(100 * median(r)) : null);
  }
  const months: Array<number | null> = new Array(12).fill(null); const monthsN: number[] = new Array(12).fill(0);
  for (const i of monthly) { const m = monthOf(run.dates[i]) - 1; months[m] = idx[i]; monthsN[m] = n[i]; }
  const valid = months.filter((x): x is number => x != null);
  const swing = valid.length ? Math.max(...valid) / Math.min(...valid) : 1;

  const monthlyN = monthly.map((i) => n[i]);
  const thinMonths = monthly.filter((i) => n[i] < THIN_BELOW).map((i) => monthOf(run.dates[i])).sort((a, b) => a - b);
  const listedMonthly = monthly.map((i) => run.listed[i]);
  const umax = Math.max(...listedMonthly); const umin = Math.min(...listedMonthly);
  // Booking.com lists fewer hotels for dates far ahead, so a seasonal closure is a month with far fewer listings than a LATER month, the opposite of that trend.
  const order = [...monthly].sort((a, b) => calendarOrder(monthOf(run.dates[a])) - calendarOrder(monthOf(run.dates[b])));
  const closedIdx = order.filter((i, j) => { const later = order.slice(j + 1).map((x) => run.listed[x]); return later.length > 0 && run.listed[i] < 0.5 * Math.max(...later); });
  const closedMonthsAll = new Set(closedIdx.map((i) => monthOf(run.dates[i])));
  const runLen = (() => {
    let best = 0;
    for (const start of closedMonthsAll) {
      if (closedMonthsAll.has(((start + 10) % 12) + 1)) continue; // not the start of a run
      let r = 1; while (closedMonthsAll.has(((start + r - 1) % 12) + 1) && r < 12) r++;
      best = Math.max(best, r);
    }
    return best;
  })();
  const closed = runLen >= 3 && umax >= 60;
  const flags: HotelFlag[] = [];
  const fewListed = umax > 0 && umax < 30;
  if (thinMonths.length >= 2 || median(monthlyN) < 8 || fewListed) flags.push('thin');
  else if (HOLIDAY_POSITIONS.some((i) => n[i] < THIN_BELOW)) flags.push('thin-holidays');
  if (closed) flags.push('closed-months');
  if (swing <= 1.12 && !closed) flags.push('flat');
  if (umax >= 30 && umax < 60) flags.push('small-market');

  const level = hotels.map((_, k) => base[k]).filter((x): x is number => x != null);
  return {
    v: 1, kind: run.kind, source: run.source, asOf: run.quotedOn, area: run.searchTerm,
    months, monthsN,
    holiday: { dec29: idx[1], dec31: idx[2], n29: n[1], n31: n[2] },
    thinMonths, closedMonths: closed ? [...closedMonthsAll].sort((a, b) => a - b) : [],
    flags, panelHotels: hotels.length, listedHotels: [umin, umax],
    levelUsd: level.length ? Math.round(median(level) / 10) * 10 : null,
    ...(run.note ? { note: run.note } : {}), events: [],
  };
}

/** Measured swing: the most expensive month's index divided by the cheapest's, over months that have an index. */
export function swingOf(s: Pick<HotelSeasonSummary, 'months'>): number | null {
  const v = s.months.filter((x): x is number => x != null);
  return v.length ? Math.round((Math.max(...v) / Math.min(...v)) * 100) / 100 : null;
}
