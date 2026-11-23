import { daysFor, type TripLength } from './trip-length';

/**
 * Which months a trip really covers (owner decision, 21 Nov 2026). The trip starts in a week of the month (week 1 is the 1st to the 7th, week 2 the
 * 8th to the 14th, week 3 the 15th to the 21st, week 4 the 22nd to the end) and lasts as long as the chosen length. The next month counts only when at
 * least a full week (7 days) of the trip falls in it; a trip that just touches the next month does not. With no month, no week or no length the trip
 * is judged on its start month alone, as before.
 */
export interface MonthShare {
  /** 0 = January. */
  month: number;
  /** How many days of the trip fall in this month. */
  days: number;
}

/** Days in each month (February as 28: the date is not known, only the week). */
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const FULL_WEEK = 7;

export const startDayOfWeek = (week: number): number => (week - 1) * 7 + 1;

export function tripMonthShares(month: number | null, week: number, length: TripLength | null | undefined): MonthShare[] {
  if (month == null) return [];
  const total = daysFor(length);
  if (!total || week < 1 || week > 4) return [{ month, days: total ?? 0 }];
  const inFirst = Math.min(total, MONTH_DAYS[month] - startDayOfWeek(week) + 1);
  const rest = total - inFirst;
  if (rest < FULL_WEEK) return [{ month, days: total }];
  return [{ month, days: inFirst }, { month: (month + 1) % 12, days: rest }];
}

const NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** One plain sentence when a trip counts two months, otherwise null. */
export function spanNote(shares: readonly MonthShare[]): string | null {
  if (shares.length < 2) return null;
  const [a, b] = shares;
  return `About ${a.days} days fall in ${NAMES[a.month]} and ${b.days} in ${NAMES[b.month]}, so both months count toward your matches.`;
}
