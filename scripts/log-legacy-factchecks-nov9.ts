// 9 Nov 2026: records, as dated whole-interest notes, the fact checks that Hiking, Whale Watching, Diving, Surfing and Safari already went through when they were written
// (sentence-level gate, place-level source checks, fact sheets), so the interest pages and the tracker show the same thing for every Gemini-authored interest. The figures are
// read from the database at run time, not typed in. Safe to re-run: skips a note that already exists. Dry run unless --apply.
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const BY = 'Claude (record of earlier checks, 9 Nov 2026)';
const KEYS: Record<string, { label: string; how: string }> = {
  hiking: { label: 'Hiking & Trekking', how: 'every risky sentence went through the sentence-level source gate before the text was applied' },
  surfing: { label: 'Surfing', how: 'places were source-checked one by one and every risky sentence went through the sentence-level gate' },
  diving: { label: 'Snorkeling & Diving', how: 'places were source-checked one by one against web sources' },
  whaleWatching: { label: 'Whale Watching', how: 'every place was source-checked one by one (124 places, 8 Oct 2026) against web sources' },
  safari: { label: 'Safari', how: 'the 17 places were written from fact sheets prepared for them' },
};
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client'); const { sql } = await import('drizzle-orm');
  const { interestReviews } = await import('../src/lib/db/schema'); const { eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write'); const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const rows = async (s: unknown) => { const r = (await db.execute(s as never)) as unknown as { rows?: unknown[] }; return ((r.rows ?? r) as Record<string, unknown>[]); };
  const fc = await rows(sql`select interest_key k, count(*)::int total, count(*) filter (where verdict in ('verified','owner_accepted'))::int ok, count(*) filter (where verdict='unchecked')::int unchecked, count(*) filter (where verdict='wrong')::int wrong from content_fact_checks group by 1`);
  const sc = await rows(sql`select interest_key k, count(distinct place_id)::int n from interest_reviews where place_id is not null and reviewer_name ~* '(web source check|second look)' group by 1`);
  const have = new Set((await db.select().from(interestReviews).where(eq(interestReviews.reviewerName, BY))).map((e) => `${e.interestKey}`));
  let n = 0;
  for (const [k, info] of Object.entries(KEYS)) {
    if (have.has(k)) continue;
    const f = fc.find((r) => r.k === k); const s = sc.find((r) => r.k === k);
    const parts = [`Fact check done (recorded 9 Nov 2026 from the checks made when ${info.label} was written): ${info.how}.`];
    if (s && Number(s.n) > 0) parts.push(`${s.n} places carry a source-check review.`);
    if (f) parts.push(`The database holds ${f.total} claim rows for this interest: ${f.ok} verified or accepted by the owner, ${f.unchecked} unchecked, ${f.wrong} marked wrong.`);
    parts.push('This note records what was done at the time; it is not a new check. The older wording rules (offers, year-round) were not part of those checks.');
    const notes = parts.join(' ');
    n++; console.log(`${apply ? 'logging' : 'would log'} ${k}: ${notes}`);
    if (apply) {
      const values = { interestKey: k, placeId: null as string | null, reviewerName: BY, reviewerRole: 'AI: Claude', reviewedOn: '2026-11-09', notes, createdBy: CLAUDE_ACTOR.email };
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${k}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
    }
  }
  console.log(`${apply ? 'logged' : 'would log'} ${n} notes`); process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
