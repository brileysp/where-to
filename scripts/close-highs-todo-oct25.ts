// 25 Oct 2026: closes the "replace the drafted afternoon highs" to-do after the real climate figures went in.
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { interestTodos } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const rows = (await db.select().from(interestTodos).where(eq(interestTodos.interestKey, 'sunbathing'))).filter((t) => t.title.startsWith('Replace the drafted afternoon highs') && t.status !== 'done');
  for (const t of rows) {
    const detail = `${t.detail}\n\nDone 25 Oct 2026: replaced with published monthly average highs (Fahrenheit, converted from Celsius where needed) read from Wikipedia climate tables for a representative station per place (196 places; each place's station is in scripts/data/sunbathing-highs-sources.json). Turks & Caicos, Antarctic Peninsula and Wales had no usable table and use ERA5 reanalysis 2010 to 2024 (Open-Meteo). A few places use a gateway town rather than the exact area (Medellín for the Colombian Andes, Three Rivers for Sequoia, Kyoto for Tokyo & Kyoto).`;
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: t.id, action: 'update', before: t, after: { ...t, status: 'done', detail }, write: (tx) => tx.update(interestTodos).set({ status: 'done', doneAt: new Date(), detail, updatedAt: new Date() }).where(eq(interestTodos.id, t.id)).returning() });
  }
  console.log('closed', rows.length);
  process.exit(0);
})();
