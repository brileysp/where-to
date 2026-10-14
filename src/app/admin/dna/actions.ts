'use server';

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { domains, subdimensions, dimensions, tensions } from '@/lib/db/schema';
import { requireAdminUser } from '@/lib/admin/auth';
import { withAdminAudit } from '@/lib/admin/write';
import { DNA_TABLES, type DnaTableKey } from '@/lib/admin/dna-config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TABLES: Record<DnaTableKey, { table: any; idColumn: string; entityType: string }> = {
  domains: { table: domains, idColumn: 'key', entityType: 'domain' },
  subdimensions: { table: subdimensions, idColumn: 'id', entityType: 'subdimension' },
  dimensions: { table: dimensions, idColumn: 'id', entityType: 'dimension' },
  tensions: { table: tensions, idColumn: 'id', entityType: 'tension' },
};

const signalSchema = z.object({
  label: z.string().min(1),
  type: z.enum(['profile', 'dimensionPole', 'rejectedAttrs']),
  keys: z.array(z.string().min(1)).min(1),
  min: z.number(),
});

export type DnaSaveResult = { ok: true; value: unknown } | { ok: false; message: string };

/** Change one cell of a Travel DNA content table. The traveller app reads these tables live, so a saved change shows straight away. */
export async function saveDnaField(tableKey: DnaTableKey, id: string, field: string, raw: string | boolean): Promise<DnaSaveResult> {
  const admin = await requireAdminUser();
  const def = DNA_TABLES.find((t) => t.key === tableKey);
  const fieldDef = def?.fields.find((f) => f.key === field);
  const cfg = TABLES[tableKey];
  if (!def || !fieldDef || !cfg) return { ok: false, message: 'That field cannot be edited here.' };

  const text = typeof raw === 'string' ? raw.trim() : '';
  let value: unknown;
  switch (fieldDef.kind) {
    case 'text':
    case 'longtext':
      if (!text) { if (!fieldDef.optional) return { ok: false, message: 'This cannot be empty.' }; value = null; } else value = text;
      break;
    case 'bool':
      value = raw === true;
      break;
    case 'int': {
      if (!text) { if (!fieldDef.optional) return { ok: false, message: 'A whole number is needed.' }; value = null; break; }
      const n = Number(text);
      if (!Number.isInteger(n) || n < 0) return { ok: false, message: 'A whole number, 0 or more.' };
      value = n;
      break;
    }
    case 'list':
      value = text.split(',').map((t) => t.trim()).filter(Boolean);
      break;
    case 'json': {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { return { ok: false, message: 'That is not valid JSON.' }; }
      const r = signalSchema.safeParse(parsed);
      if (!r.success) return { ok: false, message: `Signal: ${r.error.issues[0]?.path.join('.') ?? ''} ${r.error.issues[0]?.message ?? 'invalid'}`.trim() };
      value = r.data;
      break;
    }
  }

  const col = cfg.table[cfg.idColumn];
  const [before] = await db.select().from(cfg.table).where(eq(col, id));
  if (!before) return { ok: false, message: 'Row not found.' };
  await withAdminAudit({
    actor: admin,
    skipPlaceCache: true,
    entityType: cfg.entityType,
    entityId: id,
    action: 'update',
    before,
    after: { ...before, [field]: value },
    write: (tx) => tx.update(cfg.table).set({ [field]: value }).where(eq(col, id)),
  });
  return { ok: true, value };
}
