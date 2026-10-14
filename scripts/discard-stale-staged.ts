import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Owner decision 7 Oct 2026: the staged birding and wildlife rows are older than the live text, so they are discarded (marked invalid).
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { contentGenerations } = await import('../src/lib/db/schema');
  const { and, eq, isNull, inArray } = await import('drizzle-orm');
  const note = [{ layer: 'content', severity: 'reject', message: 'Discarded on 7 Oct 2026 by the owner: older than the live text it would have replaced (later edits, reviews and rewrites are live).' }];
  const r = await db.update(contentGenerations).set({ validationStatus: 'invalid', validationErrors: note as never })
    .where(and(eq(contentGenerations.validationStatus, 'valid'), isNull(contentGenerations.appliedAt), inArray(contentGenerations.interestKey, ['birding', 'wildlifeViewing']))).returning({ id: contentGenerations.id, k: contentGenerations.interestKey });
  console.log('discarded', r.length, JSON.stringify(r.reduce((a: Record<string, number>, x) => ({ ...a, [x.k]: (a[x.k] ?? 0) + 1 }), {})));
  process.exit(0);
})();
