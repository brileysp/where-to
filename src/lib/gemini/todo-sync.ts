import { and, eq, ne } from 'drizzle-orm';
import { db } from '../db/client';
import { interestTodos } from '../db/schema';
import { withAdminAudit } from '../admin/write';
import { SYSTEM_ACTOR } from './apply-actor';

/** "Rewrite Cuba for its wider scope (was Havana)" -> "Cuba". The place-specific to-dos made when a place was renamed or re-scoped. */
export function placeNameFromRewriteTitle(title: string): string | null {
  const m = /^Rewrite (.+?) for its (?:wider|narrower) scope/.exec(title);
  return m ? m[1] : null;
}

/**
 * Called when a generation goes live: closes every open to-do that was waiting for exactly this (a rewrite of this place's text for this
 * interest). Returns the titles it closed so the caller can report them. Safe to call for any generation; it only touches to-dos that
 * carry this place id and the closeOnApply flag.
 */
export async function closeTodosForApplied(args: { placeId: string; interestKey: string; generationId: string; promptVersion: string; notApplicable: boolean }): Promise<string[]> {
  const open = await db
    .select()
    .from(interestTodos)
    .where(and(eq(interestTodos.interestKey, args.interestKey), eq(interestTodos.placeId, args.placeId), eq(interestTodos.closeOnApply, true), ne(interestTodos.status, 'done')));
  const today = new Date().toISOString().slice(0, 10);
  const closed: string[] = [];
  for (const t of open) {
    const note = args.notApplicable
      ? `Done ${today}: the ${args.promptVersion} pass judged this place not applicable, so the old text was cleared (generation ${args.generationId}).`
      : `Done ${today}: replaced by the ${args.promptVersion} Gemini pass, now live (generation ${args.generationId}).`;
    const after = { ...t, status: 'done' as const, doneAt: new Date(), detail: t.detail ? `${t.detail}\n\n${note}` : note };
    await withAdminAudit({
      actor: SYSTEM_ACTOR,
      skipPlaceCache: true,
      entityType: 'interest_todo',
      entityId: t.id,
      action: 'update',
      before: t,
      after,
      write: (tx) => tx.update(interestTodos).set({ status: 'done', doneAt: after.doneAt, detail: after.detail, updatedAt: new Date() }).where(eq(interestTodos.id, t.id)).returning(),
    });
    closed.push(t.title);
  }
  return closed;
}

/** One finished entry in the interest's to-do list saying a pass went live: how many places, how many N/A, what was closed on the way. */
export async function logPassApplied(args: { interestKey: string; passLabel: string; applied: number; notApplicable: number; failed: number; closedTodos: string[]; extra?: string }): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [`${args.applied} generation(s) went live on ${today}${args.notApplicable ? `, ${args.notApplicable} of them marking the place N/A` : ''}${args.failed ? `; ${args.failed} could not be applied` : ''}.`];
  if (args.closedTodos.length) lines.push(`Closed automatically: ${args.closedTodos.join('; ')}.`);
  if (args.extra) lines.push(args.extra);
  const values = { interestKey: args.interestKey, title: `Gemini pass went live: ${args.passLabel}`, detail: lines.join('\n'), status: 'done' as const, source: `Pipeline apply, ${today}`, doneAt: new Date(), closeOnApply: false };
  await withAdminAudit({ actor: SYSTEM_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${args.interestKey}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
}
