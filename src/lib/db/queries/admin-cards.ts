import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { cards, domains } from '@/lib/db/schema';

export async function listCardsForAdmin() {
  return db.select().from(cards).orderBy(cards.id);
}

export async function getCardForAdmin(id: string) {
  const [row] = await db.select().from(cards).where(eq(cards.id, id));
  return row ?? null;
}

export async function listDomainKeysForAdmin(): Promise<string[]> {
  const rows = await db.select({ key: domains.key }).from(domains).orderBy(domains.key);
  return rows.map((r) => r.key);
}
