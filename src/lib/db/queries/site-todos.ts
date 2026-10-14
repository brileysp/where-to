import { inArray, ne } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { interestTodos, places } from '../schema';
import { attentionCount, todayIso } from '@/lib/admin/todo-dates';
import type { TodoRow } from '@/lib/admin/interest-pages/types';

/** A to-do on the To do tab: the usual row plus which interest it belongs to ('_site' for site-wide items). */
export type SiteTodoRow = TodoRow & { interestKey: string };

export async function listAllTodos(): Promise<{ todos: SiteTodoRow[]; placeNames: Record<string, string> }> {
  const rows = await db.select().from(interestTodos).orderBy(interestTodos.createdAt);
  const todos: SiteTodoRow[] = rows.map((r) => ({
    id: r.id,
    interestKey: r.interestKey,
    title: r.title,
    detail: r.detail,
    status: r.status,
    source: r.source,
    placeId: r.placeId,
    closeOnApply: r.closeOnApply,
    priority: r.priority,
    dueOn: r.dueOn,
    repeatEvery: r.repeatEvery,
    createdAt: r.createdAt.toISOString(),
    doneAt: r.doneAt ? r.doneAt.toISOString() : null,
  }));
  const ids = [...new Set(todos.map((t) => t.placeId).filter((x): x is string => !!x))];
  const placeNames: Record<string, string> = {};
  if (ids.length) for (const p of await db.select({ id: places.id, name: places.name }).from(places).where(inArray(places.id, ids))) placeNames[p.id] = p.name;
  return { todos, placeNames };
}

/** The number on the To do tab: open items that need you, plus open items past their check date. */
export async function getAttentionTodoCount(): Promise<number> {
  const rows = await db.select({ status: interestTodos.status, dueOn: interestTodos.dueOn }).from(interestTodos).where(ne(interestTodos.status, 'done'));
  return attentionCount(rows, todayIso());
}
