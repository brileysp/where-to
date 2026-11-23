// 9 Nov 2026: one command that runs every step of finishing an interest after the owner has reviewed it, in order, and can be re-run after a failure (each step checks whether
// it is already done). It stops at the first step it cannot do and says what is missing. What it cannot do from here (publishing the review pages and the tracker, which need
// the Artifact tool) is printed at the end, together with the steps that are the owner's; the owner's steps are also written into the admin To do tab as "needs you" items.
//
// Everything it needs for an interest lives in scripts/data/finish/<interestKey>/ (committed, so a purged scratchpad cannot lose it):
//   results.json      the reviewed Gemini results with the final texts (same shape as the family results files)
//   proposals.json    the reviewed month scores ({ cells: [...] }, one per place)
//   factcheck.json    { reviewedOn, whole, places: [{ id, note }], by } - the dated fact-check note and per-place notes
//   review.json       { reviewedOn, notes } - the owner's review, recorded on the interest page
//   lessons.json      [{ title, body }] - dated lines for the interest's "What we learned" list
//   owner-todos.json  [{ title, detail }] - steps only the owner can do (rank-check answers, N/A choices...), written as "needs you" to-dos
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/finish-interest.ts <interestKey> [--apply]
import { existsSync, readFileSync } from 'fs'; import { join } from 'path'; import { spawnSync } from 'child_process';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const root = join(__dirname, '..'); const key = process.argv[2]; const apply = process.argv.includes('--apply');
const lines: string[] = []; const say = (s: string) => { lines.push(s); console.log(s); };
(async () => {
  const { installLabelFilter } = await import('../src/lib/places/console-labels'); await installLabelFilter(); // standard D03: a report never prints a place key
  if (!key || key.startsWith('--')) { console.log('Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/finish-interest.ts <interestKey> [--apply]'); process.exit(1); }
  const dir = join(root, 'scripts', 'data', 'finish', key); const f = (n: string) => join(dir, n);
  const read = <T>(n: string): T | null => (existsSync(f(n)) ? (JSON.parse(readFileSync(f(n), 'utf8')) as T) : null);
  const { db } = await import('../src/lib/db/client'); const { sql, and, eq } = await import('drizzle-orm');
  const { interestReviews, interestRuleSections, interestTodos, authoringPasses } = await import('../src/lib/db/schema');
  const { withAdminAudit } = await import('../src/lib/admin/write'); const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const rows = async (s: unknown) => { const r = (await db.execute(s as never)) as unknown as { rows?: unknown[] }; return ((r.rows ?? r) as Record<string, unknown>[]); };
  const stop = (why: string): never => { say(`STOPPED: ${why}`); process.exit(1); };
  say(`Finishing ${key}${apply ? '' : ' (dry run: nothing is written)'}`);

  // 0. inputs
  const results = read<any[]>('results.json'); const props = read<{ cells: any[] }>('proposals.json');
  if (!results || !props) stop(`scripts/data/finish/${key}/results.json and proposals.json are required (copy the reviewed results there first)`);
  const cells = results!.filter((r) => r.k === key && r.gemini?.applicable); const propBy = new Map(props!.cells.filter((c) => c.k === key).map((c) => [c.id, c]));
  say(`0. inputs: ${cells.length} cells with text, ${propBy.size} score sets`);
  const noProp = cells.filter((c) => !propBy.has(c.id)); if (noProp.length) stop(`${noProp.length} cells have no proposed scores (first: ${noProp[0].id})`);

  // 1. backup
  const today = new Date().toISOString().slice(0, 10); const backup = `docs/backups/${key}-before-${today}.json`;
  if (existsSync(join(root, backup)) || existsSync(join(root, `docs/backups/${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}-before-${today}.json`))) say('1. backup: already taken today');
  else if (!apply) say(`1. backup: would save ${backup}`);
  else { const r = spawnSync('npx', ['tsx', 'scripts/backup-interest-fields-nov2.ts', key, backup], { cwd: root, env: process.env, encoding: 'utf8' }); if (r.status !== 0) stop('backup failed: ' + (r.stderr || r.stdout).slice(-300)); say(`1. backup: saved ${backup}`); }

  // 2. save the texts and scores (resumable)
  const ids = cells.map((c) => c.id);
  const state = async () => { const r = await rows(sql`select id, slider_overview->>${key} as o, (base_scores->>${key})::float as b from places where id = any(${sql.raw(`ARRAY[${ids.map((i) => `'${i.replace(/'/g, "''")}'`).join(',')}]::text[]`)})`); return new Map(r.map((x) => [String(x.id), x])); };
  let st = await state(); const pending = () => cells.filter((c) => st.get(c.id)?.o !== c.gemini.overview || Math.abs(Number(st.get(c.id)?.b ?? -1) - Math.max(...propBy.get(c.id).proposed)) > 0.01);
  let todo = pending();
  if (todo.length === 0) say('2. save: every text and peak is already in the app');
  else if (!apply) say(`2. save: would save ${todo.length} of ${cells.length} cells`);
  else {
    const saved = cells.filter((c) => !todo.includes(c)).map((c) => `${key}:${c.id}`);
    const batch = (await rows(sql`select id from content_generation_batches where interest_key = ${key} and started_at > now() - interval '3 days' and pass_id is not null order by started_at desc limit 1`))[0];
    const args = ['tsx', 'scripts/apply-family-text.ts', `--results=scripts/data/finish/${key}/results.json`, `--proposals=scripts/data/finish/${key}/proposals.json`, `--interests=${key}`, '--apply'];
    if (saved.length && batch) args.push(`--exclude=${saved.join(',')}`, `--reuse-batch=${batch.id}`);
    say(`2. save: saving ${todo.length} cells${saved.length && batch ? ` (resuming: ${saved.length} already saved, reusing batch)` : ''}; this takes several minutes`);
    const r = spawnSync('npx', args, { cwd: root, env: process.env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) stop('the save stopped part-way; run this command again to resume. ' + (r.stdout + r.stderr).slice(-300));
    st = await state(); todo = pending();
  }
  // 3. verify
  if (apply || todo.length === 0) { const bad = pending(); if (bad.length) stop(`${bad.length} cells do not match what was approved after the save (first: ${bad[0].id})`); say(`3. verify: all ${cells.length} cells match the approved text and peak`); } else say('3. verify: after the save');

  // 4. pass
  const passes = await db.select().from(authoringPasses).where(eq(authoringPasses.interestKey, key)); const open = passes.filter((p) => !p.finishedAt);
  if (!passes.length) stop('no authoring pass is recorded for this interest');
  if (!open.length) say(`4. pass: ${passes.length} recorded, all finished`);
  else if (!apply) say(`4. pass: would close ${open.length} open pass(es)`);
  else { for (const p of open) await db.update(authoringPasses).set({ finishedAt: new Date() }).where(eq(authoringPasses.id, p.id)); say(`4. pass: closed ${open.length}`); }

  // 5. fact-check note
  const fcDone = (await rows(sql`select 1 from interest_reviews where interest_key = ${key} and place_id is null and notes ~* '^Fact check done' limit 1`)).length > 0;
  const fc = read<{ reviewedOn: string; whole: string; by?: string; places?: Array<{ id: string; note: string }> }>('factcheck.json');
  const recentFc = fcDone && (await rows(sql`select 1 from interest_reviews where interest_key = ${key} and place_id is null and notes ~* '^Fact check done' and reviewed_on >= (now() - interval '30 days')::date limit 1`)).length > 0;
  if (recentFc) say('5. fact-check note: a dated note from the last 30 days exists');
  else if (!fc) stop(`no recent fact-check note, and scripts/data/finish/${key}/factcheck.json is missing. Write the sources used and what was corrected, then re-run`);
  else if (!apply) say('5. fact-check note: would log the note and the per-place notes');
  else {
    const by = fc!.by ?? `Claude (web source check, ${fc!.reviewedOn})`; let n = 0;
    for (const e of [{ placeId: null as string | null, notes: fc!.whole }, ...(fc!.places ?? []).map((p) => ({ placeId: p.id as string | null, notes: p.note }))]) {
      const values = { interestKey: key, placeId: e.placeId, reviewerName: by, reviewerRole: 'AI: Claude', reviewedOn: fc!.reviewedOn, notes: e.notes, createdBy: CLAUDE_ACTOR.email }; n++;
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${key}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
    }
    say(`5. fact-check note: logged ${n} notes`);
  }

  // 6. owner review row
  const ownerRev = (await rows(sql`select 1 from interest_reviews where interest_key = ${key} and place_id is null and coalesce(reviewer_role,'') !~* '^AI' and reviewer_name !~* '(claude|gemini)' and reviewed_on >= (now() - interval '30 days')::date limit 1`)).length > 0;
  const rv = read<{ reviewedOn: string; notes: string; by?: string }>('review.json');
  if (ownerRev) say("6. owner review: recorded on the interest page");
  else if (!rv) stop(`the owner's review is not recorded, and scripts/data/finish/${key}/review.json is missing`);
  else if (!apply) say("6. owner review: would record it");
  else { const values = { interestKey: key, placeId: null as string | null, reviewerName: rv!.by ?? 'Riley Pearce', reviewerRole: 'Owner', reviewedOn: rv!.reviewedOn, notes: rv!.notes, createdBy: CLAUDE_ACTOR.email }; await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${key}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() }); say('6. owner review: recorded'); }

  // 7. lessons
  const lessons = read<Array<{ title: string; body: string }>>('lessons.json');
  if (!lessons?.length) say('7. lessons: none to add (no lessons.json)');
  else {
    const [cur] = await db.select().from(interestRuleSections).where(and(eq(interestRuleSections.interestKey, key), eq(interestRuleSections.sectionKey, 'family.lessons')));
    const items = ((cur?.items ?? []) as Array<{ title: string; body: string }>); const fresh = lessons.filter((l) => !items.some((i) => i.title === l.title));
    if (!fresh.length) say('7. lessons: already on the interest page');
    else if (!apply) say(`7. lessons: would add ${fresh.length}`);
    else {
      const next = [...items, ...fresh];
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_rule_section', entityId: `${key}:family.lessons`, action: cur ? 'update' : 'create', before: cur ?? null, after: { interestKey: key, sectionKey: 'family.lessons', items: next },
        write: (tx) => tx.insert(interestRuleSections).values({ interestKey: key, sectionKey: 'family.lessons', items: next, updatedBy: CLAUDE_ACTOR.email }).onConflictDoUpdate({ target: [interestRuleSections.interestKey, interestRuleSections.sectionKey], set: { items: next, updatedBy: CLAUDE_ACTOR.email, updatedAt: new Date() } }).returning() });
      say(`7. lessons: added ${fresh.length}`);
    }
  }

  // 8. the owner's remaining steps become "needs you" to-dos
  const ot = read<Array<{ title: string; detail: string }>>('owner-todos.json') ?? [];
  let made = 0;
  for (const t of ot) {
    const [ex] = await db.select({ id: interestTodos.id }).from(interestTodos).where(and(eq(interestTodos.interestKey, key), eq(interestTodos.title, t.title)));
    if (ex) continue; made++; if (!apply) continue;
    const values = { interestKey: key, title: t.title, detail: t.detail, status: 'needs_you' as const, source: `finish-interest ${today}`, priority: 1 };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${key}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
  }
  say(`8. owner to-dos: ${ot.length ? `${apply ? 'created' : 'would create'} ${made} new "needs you" items (${ot.length - made} already there)` : 'none listed (no owner-todos.json)'}`);

  // 9. what is left for Claude's tools and for the owner
  say('\nStill to do (needs the Artifact tool, so not done by this script):');
  say('  - rebuild the review page from the saved texts and publish it');
  say('  - build and publish the rank-check page if one is not published, then apply the owner\'s answers with apply-rank-moves-nov1.ts');
  say('  - refresh and publish the tracker (npx tsx scripts/interest-completeness.ts, then the template) and set the owner\'s marks there');
  say('  - run `npm run interest:status` and read the gaps for this interest');
  if (ot.length) { say('Owner steps (also in the To do tab):'); for (const t of ot) say(`  - ${t.title}`); }
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
