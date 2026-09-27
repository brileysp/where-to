'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db/client';
import { cards, adminAuditLog } from '@/lib/db/schema';
import { requireAdminUser } from '@/lib/admin/auth';
import { withAdminAudit } from '@/lib/admin/write';
import { cardFormSchema, cardFormRawInput, formatCardFormErrors } from '@/lib/admin/card-schema';

export interface CardFormState {
  error: string | null;
}

export async function createCard(_prevState: CardFormState, formData: FormData): Promise<CardFormState> {
  const admin = await requireAdminUser();

  const result = cardFormSchema.safeParse(cardFormRawInput(formData));
  if (!result.success) return { error: formatCardFormErrors(result.error) };
  const values = result.data;

  const existing = await db.select({ id: cards.id }).from(cards).where(eq(cards.id, values.id));
  if (existing.length > 0) return { error: `A card with id "${values.id}" already exists.` };

  await withAdminAudit({
    actor: admin,
    entityType: 'card',
    entityId: values.id,
    action: 'create',
    before: null,
    after: values,
    write: (tx) => tx.insert(cards).values(values),
  });

  redirect('/admin/cards');
}

export async function updateCard(id: string, _prevState: CardFormState, formData: FormData): Promise<CardFormState> {
  const admin = await requireAdminUser();

  const result = cardFormSchema.safeParse(cardFormRawInput(formData));
  if (!result.success) return { error: formatCardFormErrors(result.error) };
  const values = result.data;

  if (values.id !== id) return { error: 'The id field cannot be changed after a card is created.' };

  const [before] = await db.select().from(cards).where(eq(cards.id, id));
  if (!before) return { error: `No card found with id "${id}".` };

  await withAdminAudit({
    actor: admin,
    entityType: 'card',
    entityId: id,
    action: 'update',
    before,
    after: values,
    write: (tx) =>
      tx
        .update(cards)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(cards.id, id)),
  });

  redirect('/admin/cards');
}

/** Restore = write an old snapshot back through the same write path a normal edit uses — see the matching comment on restoreDestinationVersion in ../destinations/actions.ts for the full rationale (including the deliberate skip of re-validation). */
export async function restoreCardVersion(id: string, auditId: string, _formData: FormData): Promise<void> {
  const admin = await requireAdminUser();

  const [auditRow] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.id, auditId));
  if (!auditRow || auditRow.entityType !== 'card' || auditRow.entityId !== id) {
    redirect(`/admin/cards/${id}/history?error=1`);
  }

  const snapshot = auditRow.afterValue as (typeof cards.$inferSelect) | null;
  if (!snapshot) redirect(`/admin/cards/${id}/history?error=1`);

  const [before] = await db.select().from(cards).where(eq(cards.id, id));
  if (!before) redirect(`/admin/cards/${id}/history?error=1`);

  const { id: _snapshotId, updatedAt: _snapshotUpdatedAt, ...restoreValues } = snapshot;

  await withAdminAudit({
    actor: admin,
    entityType: 'card',
    entityId: id,
    action: 'update',
    before,
    after: { ...before, ...restoreValues },
    write: (tx) =>
      tx
        .update(cards)
        .set({ ...restoreValues, updatedAt: new Date() })
        .where(eq(cards.id, id)),
  });

  redirect(`/admin/cards/${id}/history`);
}
