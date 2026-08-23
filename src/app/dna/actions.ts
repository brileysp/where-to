'use server';

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { userDnaState, userSwipes } from '@/lib/db/schema';
import { getCurrentUserId } from '@/lib/supabase/current-user';
import type { DnaState, Swipe } from '@/lib/dna/types';

const DNA_STATE_VERSION = '1';

export async function loadDnaState(): Promise<DnaState | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const [row] = await db.select().from(userDnaState).where(eq(userDnaState.userId, userId));
  return row ? (row.state as DnaState) : null;
}

export async function saveDnaState(state: DnaState, lastSwipe?: Swipe): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  await db
    .insert(userDnaState)
    .values({ userId, state, version: DNA_STATE_VERSION })
    .onConflictDoUpdate({
      target: userDnaState.userId,
      set: { state, version: DNA_STATE_VERSION, updatedAt: new Date() },
    });

  if (lastSwipe) {
    await db.insert(userSwipes).values({
      userId,
      cardId: lastSwipe.cardId,
      swipeType: lastSwipe.type,
    });
  }
}

/** Wipes Travel DNA state + swipe history entirely — the next load starts fresh, same as a brand-new visitor. */
export async function resetDnaState(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  await db.delete(userDnaState).where(eq(userDnaState.userId, userId));
  await db.delete(userSwipes).where(eq(userSwipes.userId, userId));
}
