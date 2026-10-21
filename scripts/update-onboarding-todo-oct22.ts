// 22 Oct 2026: the "Turn on the new onboarding flow" to-do no longer needs a hosting setting. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/update-onboarding-todo-oct22.ts
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { interestTodos } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const rows = await db.select().from(interestTodos);
  const row = rows.find((r) => r.title === 'Turn on the new onboarding flow in production');
  if (!row) { console.log('to-do not found'); process.exit(1); }
  await db.update(interestTodos).set({
    title: 'Try the new onboarding with live questions, then tell Claude to switch it on',
    detail: 'Built 22 Oct 2026 and switched off. It is behind a database setting, not a hosting setting: you do not need to touch hosting. Ask Claude for the private preview address to try it while it is off for everyone; when you approve, say "switch the new onboarding on" (and "off" to go back). The old flow stays as the fallback.',
    updatedAt: new Date(),
  } as never).where(eq(interestTodos.id, row.id));
  console.log('updated', row.id.slice(0, 8));
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
