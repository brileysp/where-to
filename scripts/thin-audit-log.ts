// Slims the database's two biggest logs (owner request, 14 Oct 2026). Safe to re-run.
//  1. admin_audit_log: older place edits written by scripts and the Gemini pipeline keep only what changed (src/lib/admin/audit-diff.ts), not two full
//     copies of the place. Kept in full: every edit by a person, and the newest 3 entries of each place (restore points). Because a thinned entry still
//     holds the exact before and after of every value it changed, any older state can be rebuilt from a newer full one.
//  2. content_generations.raw_response: the encrypted "thought signature" blobs (about 70% of the size, unreadable) are removed.
// Then VACUUM FULL gives the space back (the free plan counts the file size, not the live rows).
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/thin-audit-log.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

const SYSTEM_ACTORS = ['00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000c1a', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'];
const KEEP_NEWEST = 3;

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { sql } = await import('drizzle-orm');
  const { auditDiff } = await import('../src/lib/admin/audit-diff');
  const rows = async (r: any) => (r.rows ?? r) as any[];
  const mb = (n: unknown) => (Number(n) / 1048576).toFixed(1);
  const sizes = async () => (await rows(await db.execute(sql`select (select pg_total_relation_size('admin_audit_log')) a, (select pg_total_relation_size('content_generations')) g, pg_database_size(current_database()) d`)))[0];
  const before = await sizes();
  console.log(`before: audit log ${mb(before.a)} MB, generations ${mb(before.g)} MB, whole database ${mb(before.d)} MB`);

  const DIFF_FN = sql`create or replace function pg_temp.audit_diff(b jsonb, a jsonb, pick_after boolean) returns jsonb language sql immutable as $$
    select coalesce(jsonb_object_agg(k,
      case when jsonb_typeof(b->k) = 'object' and jsonb_typeof(a->k) = 'object' then
        jsonb_build_object('__sub', (select coalesce(jsonb_object_agg(s, case when pick_after then a->k->s else b->k->s end), '{}'::jsonb)
                                     from (select jsonb_object_keys(coalesce(b->k, '{}'::jsonb) || coalesce(a->k, '{}'::jsonb)) s) ss
                                     where (b->k->s) is distinct from (a->k->s)))
      else case when pick_after then a->k else b->k end end), '{}'::jsonb)
    from (select jsonb_object_keys(b || a) k) kk
    where k <> 'id' and (b->k) is distinct from (a->k)
  $$`;
  const TARGETS = sql`select a.id from admin_audit_log a join (select id, row_number() over (partition by entity_id order by created_at desc) rn from admin_audit_log where entity_type = 'destination' and action = 'update') r on r.id = a.id
    where r.rn > ${KEEP_NEWEST} and a.before_value is not null and a.after_value is not null and a.after_value ? 'id' and a.actor_id::text in (${sql.join(SYSTEM_ACTORS.map((x) => sql`${x}`), sql`, `)})`;

  await db.transaction(async (tx: any) => {
    await tx.execute(DIFF_FN);
    const [n] = await rows(await tx.execute(sql`select count(*) n from (${TARGETS}) t`));
    console.log('audit entries to thin:', n.n);
    // Check the SQL against the TypeScript version on a sample before changing anything.
    const sample = await rows(await tx.execute(sql`select a.id, a.before_value b, a.after_value a, pg_temp.audit_diff(a.before_value, a.after_value, false) sb, pg_temp.audit_diff(a.before_value, a.after_value, true) sa from admin_audit_log a where a.id in (select id from (${TARGETS}) t) order by a.id limit 6`));
    const norm = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([p], [q]) => p.localeCompare(q))) : x));
    let ok = 0;
    for (const r of sample) { const ts = auditDiff(r.b, r.a)!; if (norm(ts.before) === norm(r.sb) && norm(ts.after) === norm(r.sa)) ok++; else console.log('MISMATCH', r.id); }
    console.log(`sample check: ${ok} of ${sample.length} entries identical between the SQL and the TypeScript version`);
    if (ok !== sample.length) throw new Error('sample mismatch, stopping');
    const [proj] = await rows(await tx.execute(sql`select sum(pg_column_size(a.before_value) + pg_column_size(a.after_value))::bigint old, sum(pg_column_size(pg_temp.audit_diff(a.before_value, a.after_value, false)) + pg_column_size(pg_temp.audit_diff(a.before_value, a.after_value, true)))::bigint new from admin_audit_log a where a.id in (select id from (${TARGETS}) t)`));
    console.log(`those entries: ${mb(proj.old)} MB now, about ${mb(proj.new)} MB after`);
    if (!apply) { console.log('dry run: nothing changed'); return; }
    const upd = await tx.execute(sql`update admin_audit_log a set before_value = pg_temp.audit_diff(a.before_value, a.after_value, false), after_value = pg_temp.audit_diff(a.before_value, a.after_value, true) where a.id in (select id from (${TARGETS}) t)`);
    console.log('thinned', (upd as any).count ?? (upd as any).rowCount ?? 'ok');
    const sig = await tx.execute(sql`update content_generations set raw_response = jsonb_set(raw_response, '{candidates}', coalesce((select jsonb_agg(case when jsonb_typeof(c #> '{content,parts}') = 'array' then jsonb_set(c, '{content,parts}', (select coalesce(jsonb_agg(p - 'thoughtSignature' order by ord), '[]'::jsonb) from jsonb_array_elements(c #> '{content,parts}') with ordinality as t(p, ord))) else c end order by cord) from jsonb_array_elements(raw_response -> 'candidates') with ordinality as cc(c, cord)), '[]'::jsonb)) where raw_response ? 'candidates' and raw_response::text like '%thoughtSignature%'`);
    console.log('generations stripped', (sig as any).count ?? (sig as any).rowCount ?? 'ok');
  });
  if (apply) {
    await db.execute(sql`vacuum full admin_audit_log`);
    await db.execute(sql`vacuum full content_generations`);
    const after = await sizes();
    console.log(`after: audit log ${mb(after.a)} MB, generations ${mb(after.g)} MB, whole database ${mb(after.d)} MB`);
  }
  process.exit(0);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
