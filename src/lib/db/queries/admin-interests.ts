import { db } from '@/lib/db/client';
import { and, asc, eq, ne } from 'drizzle-orm';
import { interestMeta, interestTodos } from '@/lib/db/schema';
import { CADENCE_TODO_SOURCE } from '@/lib/scoring/planning';

export async function listInterestMetaForAdmin() {
  return db.select().from(interestMeta).orderBy(interestMeta.key);
}

/** For each interest, the check-on date of its open repeating review to-do (the earliest if there are several). */
export async function getNextReviewByInterest(): Promise<Record<string, string>> {
  const rows = await db
    .select({ key: interestTodos.interestKey, dueOn: interestTodos.dueOn })
    .from(interestTodos)
    .where(and(eq(interestTodos.source, CADENCE_TODO_SOURCE), ne(interestTodos.status, 'done')))
    .orderBy(asc(interestTodos.dueOn));
  const out: Record<string, string> = {};
  for (const r of rows) if (r.dueOn && !out[r.key]) out[r.key] = r.dueOn;
  return out;
}
