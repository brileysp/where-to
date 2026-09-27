import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { adminAuditLog } from '@/lib/db/schema';

export async function listAuditHistory(entityType: string, entityId: string) {
  return db
    .select()
    .from(adminAuditLog)
    .where(and(eq(adminAuditLog.entityType, entityType), eq(adminAuditLog.entityId, entityId)))
    .orderBy(desc(adminAuditLog.createdAt));
}

export async function getAuditEntry(id: string) {
  const [row] = await db.select().from(adminAuditLog).where(eq(adminAuditLog.id, id));
  return row ?? null;
}
