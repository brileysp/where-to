/**
 * Date helpers for the To do tab. Dates are plain "YYYY-MM-DD" strings (no time of day), so every
 * calculation here works on UTC midnight and never shifts by a timezone.
 */

export const SITE_TODO_KEY = '_site';
export type TodoRepeat = 'weekly' | 'monthly';

const DAY = 86_400_000;
const parse = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const format = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Today's date where the owner is (the admin works in Pacific time), as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

export function daysUntil(dueOn: string, today: string): number {
  return Math.round((parse(dueOn) - parse(today)) / DAY);
}

function addMonth(iso: string): string {
  const d = new Date(parse(iso));
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return format(d.getTime());
}

const step = (iso: string, repeat: TodoRepeat) => (repeat === 'weekly' ? format(parse(iso) + 7 * DAY) : addMonth(iso));

/** The date of the next copy of a repeating item: one step after its date, skipping any dates already past. */
export function nextDueOn(dueOn: string | null, repeat: TodoRepeat, today: string): string {
  let next = step(dueOn ?? today, repeat);
  while (parse(next) <= parse(today)) next = step(next, repeat);
  return next;
}

export type DueInfo = { text: string; tone: 'over' | 'soon' | 'later' };

/** "overdue by 2 days", "today", "in 3 days"... and a tone for colouring it. */
export function dueInfo(dueOn: string, today: string): DueInfo {
  const n = daysUntil(dueOn, today);
  if (n < 0) return { text: n === -1 ? 'overdue by 1 day' : `overdue by ${-n} days`, tone: 'over' };
  if (n === 0) return { text: 'today', tone: 'soon' };
  if (n === 1) return { text: 'tomorrow', tone: 'soon' };
  return { text: `in ${n} days`, tone: n <= 5 ? 'soon' : 'later' };
}

export type SortableTodo = { status: string; priority: number; dueOn: string | null; createdAt: string };

export const isOpen = (t: { status: string }) => t.status !== 'done';
export const isOverdue = (t: { status: string; dueOn: string | null }, today: string) => isOpen(t) && t.dueOn !== null && t.dueOn < today;

/** Overdue first, then dated items soonest first, then undated by priority (high first) and age. */
export function compareTodos(a: SortableTodo, b: SortableTodo): number {
  const rank = (t: SortableTodo) => (t.dueOn ? 0 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (a.dueOn && b.dueOn && a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1;
  return a.priority - b.priority || a.createdAt.localeCompare(b.createdAt);
}

/** How many open items want attention now: needs you, or past their check date. Shown on the tab. */
export function attentionCount(todos: Array<{ status: string; dueOn: string | null }>, today: string): number {
  return todos.filter((t) => isOpen(t) && (t.status === 'needs_you' || isOverdue(t, today))).length;
}
