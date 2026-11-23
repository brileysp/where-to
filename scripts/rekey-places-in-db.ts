// 18 Nov 2026, step 3 of docs/place-naming-plan.md: makes the place KEY the database id. places.id becomes p0001..p0200 and every row that points at a place follows.
// Everything runs inside ONE transaction. Default is a REHEARSAL: it does all the work, prints what changed in each table, runs the checks, then rolls back (nothing is saved).
// --apply does the same and commits, but only if every check passed. --reverse moves keys back to the old ids (the way back if anything is wrong); the rehearsal always tests a round trip first: forward, then back, then checks that the database is exactly as it started. Needs scripts/check-place-identity.ts to pass first. Afterwards: delete .cache/place-rows.json and restart the dev server.
// What it does, in order: (1) refuses to run if any column that looks like a place id is not covered below; (2) drops each foreign key to places.id and re-adds it with ON UPDATE CASCADE;
// (3) sets places.id to the key, which cascades to the foreign-key tables and to place_identity.place_id; (4) updates the tables that hold a place id without a foreign key;
// (5) updates admin_audit_log.entity_id (destination rows, and "placeId:interest" rows); (6) re-adds the original foreign keys; (7) checks everything.
// Old ids inside the text of audit-log payloads are left as they are (history); every old id still resolves through place_id_redirects.
// Usage: PLACE_ROWS_FRESH=1 npx tsx scripts/rekey-places-in-db.ts [--apply] [--reverse]
import { readFileSync, rmSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const NO_FK: Array<[string, string]> = [['content_fact_checks', 'place_id'], ['content_generations', 'place_id'], ['interest_place_ideas', 'promoted_place_id'], ['interest_reviews', 'place_id'], ['interest_todos', 'place_id'], ['place_chip_overrides', 'place_id'], ['place_interest_facts', 'place_id']];
class Rollback extends Error {}
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client'); const { sql } = await import('drizzle-orm');
  const report: string[] = []; const problems: string[] = [];
  const reverse = process.argv.includes('--reverse');
  { const r: any = await db.execute(sql`select count(*) filter (where id ~ '^p[0-9]{4}$')::int k, count(*)::int n from places`); const x = (r.rows ?? r)[0];
    if (!reverse && x.k === x.n) { console.log(`All ${x.n} places are already on keys (switched on 18 Nov 2026); nothing to do. Use --reverse to move back to the old ids.`); process.exit(0); }
    if (reverse && x.k === 0) { console.log('No place is on a key; nothing to reverse.'); process.exit(0); } }
  const rows = async (tx: any, q: any) => { const r: any = await tx.execute(q); return (r.rows ?? r) as any[]; };
  // One direction of the move. forward: old id -> key. back: key -> old id. Returns nothing; pushes to report/problems.
  const move = async (tx: any, back: boolean) => {
    const FROM = sql.raw(back ? 'place_key' : 'old_id'); const TO = sql.raw(back ? 'old_id' : 'place_key'); const tag = back ? 'BACK ' : '';
    const one = async (label: string, q: any) => { const r = await rows(tx, q); const n = r[0]?.n ?? 0; report.push(`${tag}${label}`.padEnd(62) + ` ${String(n).padStart(6)} rows`); return n as number; };
    const ident = await rows(tx, sql`select count(*)::int n, count(distinct key)::int k from place_identity`); if (ident[0].n !== 200 || ident[0].k !== 200) throw new Error(`place_identity has ${ident[0].n} rows`);
    const cols = await rows(tx, sql`select table_name t, column_name c from information_schema.columns where table_schema='public' and (column_name ilike '%place_id%' or column_name ilike '%placeid%')`);
    const fk = await rows(tx, sql`select conrelid::regclass::text tbl, conname, pg_get_constraintdef(oid) def, (select attname from pg_attribute where attrelid=conrelid and attnum=conkey[1]) col from pg_constraint where contype='f' and confrelid='places'::regclass`);
    const known = new Set<string>([...fk.map((f) => `${f.tbl}.${f.col}`), ...NO_FK.map(([t, c]) => `${t}.${c}`), 'place_identity.place_id', 'place_label_history.place_key', 'place_slug_redirects.place_key', 'place_id_redirects.place_key', 'place_id_redirects.old_id']);
    for (const c of cols) if (!known.has(`${c.t}.${c.c}`)) problems.push(`column ${c.t}.${c.c} looks like a place id and is not handled`);
    if (problems.length) throw new Error(problems.join('; '));
    for (const f of fk) { if (f.tbl === 'place_identity') continue; await tx.execute(sql.raw(`ALTER TABLE ${f.tbl} DROP CONSTRAINT "${f.conname}"`)); await tx.execute(sql.raw(`ALTER TABLE ${f.tbl} ADD CONSTRAINT "${f.conname}" ${f.def.replace(/ ON UPDATE \w+( \w+)?/, '')} ON UPDATE CASCADE`)); }
    report.push(`${tag}foreign keys switched to cascade for the move: ${fk.filter((f) => f.tbl !== 'place_identity').map((f) => f.tbl).join(', ')}`);
    const before: Record<string, number> = {}; for (const f of fk) before[`${f.tbl}.${f.col}`] = (await rows(tx, sql.raw(`select count(*)::int n from ${f.tbl} where "${f.col}" is not null`)))[0].n;
    await one('places.id', sql`with u as (update places set id = r.${TO} from place_id_redirects r where r.${FROM} = places.id returning 1) select count(*)::int n from u`);
    const newPat = back ? '^p[0-9]{4}$' : '^p[0-9]{4}$'; // forward: rows should now match the key pattern; back: rows should now NOT match it
    for (const f of fk) { const n = (await rows(tx, sql.raw(`select count(*)::int n from ${f.tbl} where "${f.col}" ${back ? '!~' : '~'} '${newPat}'`)))[0].n; report.push(`${tag}  follows by cascade: ${f.tbl}.${f.col}`.padEnd(62) + ` ${String(n).padStart(6)} of ${before[`${f.tbl}.${f.col}`]} rows moved`); if (n !== before[`${f.tbl}.${f.col}`]) problems.push(`${f.tbl}.${f.col}: ${n} of ${before[`${f.tbl}.${f.col}`]} rows moved`); }
    for (const [t, c] of NO_FK) await one(`${t}.${c}`, sql.raw(`with u as (update ${t} set "${c}" = r.${back ? 'old_id' : 'place_key'} from place_id_redirects r where ${t}."${c}" = r.${back ? 'place_key' : 'old_id'} returning 1) select count(*)::int n from u`));
    await one('admin_audit_log.entity_id (destination rows)', sql.raw(`with u as (update admin_audit_log set entity_id = r.${back ? 'old_id' : 'place_key'} from place_id_redirects r where entity_type = 'destination' and entity_id = r.${back ? 'place_key' : 'old_id'} returning 1) select count(*)::int n from u`));
    await one('admin_audit_log.entity_id ("placeId:interest" rows)', sql.raw(`with u as (update admin_audit_log a set entity_id = r.${back ? 'old_id' : 'place_key'} || substr(a.entity_id, length(r.${back ? 'place_key' : 'old_id'}) + 1) from place_id_redirects r where a.entity_type = 'place_interest_fact' and a.entity_id like r.${back ? 'place_key' : 'old_id'} || ':%' returning 1) select count(*)::int n from u`));
    for (const f of fk) { if (f.tbl === 'place_identity') continue; await tx.execute(sql.raw(`ALTER TABLE ${f.tbl} DROP CONSTRAINT "${f.conname}"`)); await tx.execute(sql.raw(`ALTER TABLE ${f.tbl} ADD CONSTRAINT "${f.conname}" ${f.def}`)); }
    // checks: nothing is left on the side we moved away from
    const leftovers: string[] = []; const stale = sql.join((await rows(tx, sql`select ${FROM} v from place_id_redirects`)).map((r) => sql`${r.v}`), sql`, `);
    for (const [t, c] of [...NO_FK, ['places', 'id'], ['places', 'parent_place_id'], ['place_identity', 'place_id'], ['place_relationships', 'from_place_id'], ['place_relationships', 'to_place_id'], ['user_stamps', 'place_id'], ['place_hotel_quote_runs', 'place_id'], ['place_hotel_season', 'place_id']] as Array<[string, string]>) { const n = (await rows(tx, sql`select count(*)::int n from ${sql.raw(t)} where ${sql.raw(`"${c}"`)} in (${stale})`))[0].n; if (n) leftovers.push(`${t}.${c}: ${n} rows still on the old side`); }
    const aud = (await rows(tx, sql`select count(*)::int n from admin_audit_log where (entity_type='destination' and entity_id in (${stale})) or (entity_type='place_interest_fact' and split_part(entity_id, ':', 1) in (${stale}))`))[0].n; if (aud) leftovers.push(`admin_audit_log: ${aud} rows still on the old side`);
    const bad = (await rows(tx, sql.raw(`select count(*)::int n from places where id ${back ? '~' : '!~'} '^p[0-9]{4}$'`)))[0].n; if (bad) leftovers.push(`${bad} places on the wrong side`);
    const same = (await rows(tx, sql.raw(`select count(*)::int n from place_identity pi join place_id_redirects r on r.place_key = pi.key where pi.place_id <> r.${back ? 'old_id' : 'place_key'}`)))[0].n; if (same) leftovers.push(`${same} identity rows whose place_id is on the wrong side`);
    const fk2 = await rows(tx, sql`select conname, pg_get_constraintdef(oid) def from pg_constraint where contype='f' and confrelid='places'::regclass`); for (const f of fk) { const g = fk2.find((x) => x.conname === f.conname); if (!g || g.def !== f.def) leftovers.push(`foreign key ${f.conname} not restored`); }
    problems.push(...leftovers);
    report.push(`${tag}${problems.length ? 'CHECKS FAILED: ' + problems.join('; ') : 'checks passed: nothing left on the old side, original foreign keys restored.'}`);
    if (problems.length) throw new Rollback('checks failed');
  };
  try {
    await db.transaction(async (tx: any) => {
      const snap = async () => (await rows(tx, sql`select (select md5(string_agg(id, ',' order by id)) from places) p, (select count(*)::int from content_fact_checks where place_id in (select id from places)) f, (select md5(string_agg(entity_id, ',' order by entity_id)) from admin_audit_log where entity_type='destination') a`))[0];
      const start = await snap();
      if (reverse) { await move(tx, true); } else { await move(tx, false); if (!apply) { report.push('--- round trip: moving everything back inside the same rehearsal ---'); await move(tx, true); const end = await snap(); if (JSON.stringify(end) !== JSON.stringify(start)) { problems.push('the round trip did not restore the database exactly'); report.push('ROUND TRIP FAILED'); throw new Rollback('round trip'); } report.push('round trip restored the database exactly as it started (same place ids, same audit-log ids).'); } }
      if (!apply && !reverse) throw new Rollback('rehearsal');
      if (!apply && reverse) throw new Rollback('rehearsal');
    });
  } catch (e: any) { if (!(e instanceof Rollback)) { console.log(report.join('\n')); console.log('\nERROR, nothing saved:', e.message); process.exit(1); } }
  console.log(report.join('\n'));
  if (!apply) console.log('\nREHEARSAL ONLY: everything above was rolled back; the database is unchanged.');
  else if (problems.length) console.log('\nNOT APPLIED: checks failed, nothing saved.');
  else { console.log('\nAPPLIED and committed.'); try { rmSync(join(__dirname, '..', '.cache/place-rows.json')); console.log('Deleted .cache/place-rows.json; restart the dev server.'); } catch { /* none */ } }
  process.exit(problems.length ? 1 : 0);
})();
