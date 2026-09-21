import { readFileSync } from 'fs';
import { join } from 'path';
import type { StampedCostItem } from '../src/lib/admin/cost-item-stamp';

/**
 * One-time backfill for per-item cost tracking (see src/lib/admin/cost-item-stamp.ts).
 *
 * 1. Gives every existing cost item a stable `id`.
 * 2. Replays each place's admin_audit_log history to fill in who/when/what for
 *    items a human already edited through the admin panel. Items never touched
 *    through the panel (seed data, content scripts) stay unstamped — which is
 *    exactly what "never updated by a human" should show.
 *
 * Safety: the replay result is only written if it reproduces the place's
 * current items exactly (label/price/unit/icon). Otherwise (edits made outside
 * the log) that place just gets ids, no history, and is listed in the report.
 * Attribution assumes the single ADMIN_EMAIL admin. Dry run by default;
 * pass --write to save. Does not touch places.updated_at.
 */

function loadDotEnvLocal(): void {
  let raw: string;
  try {
    raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadDotEnvLocal();

const content = (i: StampedCostItem) => JSON.stringify([i.label, i.price, i.unit ?? '', i.emoji ?? null]);
const items = (v: unknown): StampedCostItem[] | null => {
  const arr = (v as { costItems?: unknown } | null)?.costItems;
  return Array.isArray(arr) ? (arr as StampedCostItem[]) : null;
};

async function main() {
  const write = process.argv.includes('--write');
  // --redo recomputes history from scratch (keeping existing ids) even for places that already have ids.
  const redo = process.argv.includes('--redo');
  if (!process.env.DATABASE_URL) {
    console.error('No DATABASE_URL found in .env.local — refusing to run against the PGlite fallback.');
    process.exit(1);
  }
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin';
  const { db } = await import('../src/lib/db/client');
  const { places, adminAuditLog } = await import('../src/lib/db/schema');
  const { and, asc, eq } = await import('drizzle-orm');
  const { stampCostItems } = await import('../src/lib/admin/cost-item-stamp');

  const rows = await db.select({ id: places.id, costItems: places.costItems }).from(places);
  let stampedPlaces = 0, idOnly = 0, mismatched: string[] = [], stampedItems = 0, unchanged = 0;

  for (const row of rows) {
    const current = row.costItems as StampedCostItem[];
    if (current.length === 0) continue;
    if (!redo && current.every((i) => i.id)) { unchanged++; continue; }

    const log = (await db.select().from(adminAuditLog)
      .where(and(eq(adminAuditLog.entityId, row.id), eq(adminAuditLog.action, 'update')))
      .orderBy(asc(adminAuditLog.createdAt)))
      .filter((r) => {
        const b = items(r.beforeValue), a = items(r.afterValue);
        return b && a && JSON.stringify(b.map(content)) !== JSON.stringify(a.map(content));
      });

    // Baseline: current items, ids kept/assigned, any previous stamps stripped.
    let result: StampedCostItem[] = current.map((i) => {
      const { updatedAt, updatedBy, editorKind, lastChange, ...rest } = i;
      void updatedAt; void updatedBy; void editorKind; void lastChange;
      return { ...rest, id: i.id ?? globalThis.crypto.randomUUID() };
    });
    if (log.length > 0) {
      let running: StampedCostItem[] = items(log[0].beforeValue)!.map((i) => ({ ...i, id: i.id ?? globalThis.crypto.randomUUID() }));
      for (const r of log) {
        running = stampCostItems(running, items(r.afterValue)!, { name: adminEmail, kind: 'human' }, r.createdAt);
      }
      if (JSON.stringify(running.map(content)) === JSON.stringify(current.map(content))) {
        result = running.map((it, k) => ({ ...it, id: current[k].id ?? it.id }));
        stampedPlaces++;
        stampedItems += running.filter((i) => i.updatedBy).length;
      } else {
        mismatched.push(row.id);
        idOnly++;
      }
    } else {
      idOnly++;
    }
    if (write) await db.update(places).set({ costItems: result as never }).where(eq(places.id, row.id));
  }

  console.log(`${write ? 'WROTE' : 'DRY RUN'}: ${stampedPlaces} places with history replayed (${stampedItems} items stamped), ${idOnly} places got ids only, ${unchanged} already done.`);
  if (mismatched.length) console.log(`History didn't reproduce current items (ids only) for: ${mismatched.join(', ')}`);
  process.exit(0);
}

main();
