// 21 Nov 2026: the owner reviewed the proposed scopes for the 20 renamed or widened places in the artifact (https://claude.ai/artifact/NL6UrMr9mu2ySkfYuKi4Kk) and said they all looked good.
// Saves each through changeScope (the same function the admin Names & scope screen uses) and confirms it. The scope version is not bumped: version 2 already marks these places as widened,
// and data written for the old place carries version 1, so it stays listed as made for a different scope.
// Usage: npx tsx scripts/set-scopes-nov21.ts
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { installLabelFilter } = await import('../src/lib/places/console-labels'); await installLabelFilter();
  const { changeScope } = await import('../src/lib/places/edit'); const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { db } = await import('../src/lib/db/client'); const { placeIdentity } = await import('../src/lib/db/schema'); const { eq } = await import('drizzle-orm');
  const S = JSON.parse(readFileSync(join(__dirname, 'data', 'scope-confirmed-nov21.json'), 'utf8')) as Record<string, { level: string; anchors: string[]; note: string }>;
  for (const [key, s] of Object.entries(S)) {
    const [b] = await db.select().from(placeIdentity).where(eq(placeIdentity.key, key));
    const res = await changeScope(CLAUDE_ACTOR, key, { level: s.level, anchorsText: s.anchors.join('; '), note: s.note, changesCoverage: false, confirm: true });
    const [a] = await db.select().from(placeIdentity).where(eq(placeIdentity.key, key));
    console.log(b.label, '|', b.scopeStatus, 'v' + b.scopeVersion, '->', a.scopeStatus, 'v' + a.scopeVersion, '|', (res as any).ok ? 'saved' : (res as any).error);
  }
  process.exit(0);
})();
