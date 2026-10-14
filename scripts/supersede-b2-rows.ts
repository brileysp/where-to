import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Marks the two batch-two rows replaced by the 7 Oct 2026 regeneration (fixed fact sheets) so a whole-batch apply skips them.
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { contentGenerations } = await import('../src/lib/db/schema');
  const { and, eq, inArray } = await import('drizzle-orm');
  const note = [{ layer: 'content', severity: 'reject', message: 'Superseded on 7 Oct 2026 by batch 0e674e5f (regenerated after the old place name was removed from the fact sheet).' }];
  const r = await db.update(contentGenerations).set({ validationStatus: 'invalid', validationErrors: note as never })
    .where(and(eq(contentGenerations.batchId, '423c33ad-2e1b-4c36-86a8-95e94e7f8a63'), inArray(contentGenerations.placeId, ['punta-cana', 'snowdonia']))).returning({ id: contentGenerations.id, p: contentGenerations.placeId });
  console.log(r);
  process.exit(0);
})();
