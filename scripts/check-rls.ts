// Lists every table in the public schema that has Row-Level Security off. Supabase emails a "Table publicly accessible" warning for each one.
// Run after adding any table. New tables need `ALTER TABLE "x" ENABLE ROW LEVEL SECURITY;` in their migration.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/check-rls.ts
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { sql } = await import('drizzle-orm');
  const r = await db.execute(sql`select c.relname as t from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity order by c.relname`);
  const rows = (r.rows ?? r) as Array<{ t: string }>;
  console.log(rows.length === 0 ? 'Every table in the public schema has Row-Level Security on.' : `Row-Level Security is OFF on: ${rows.map((x) => x.t).join(', ')}`);
  process.exit(rows.length === 0 ? 0 : 1);
})();
