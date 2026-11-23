// 29 Oct 2026 (owner approved question 4 of the Planning scores proposal): makes one repeating review to-do per interest from its Evergreen score.
// Monthly, quarterly and annual interests get a to-do that comes back on its own when it is ticked done. Check-on dates are staggered so the reviews do not
// all land in one week. An interest that already has an open review to-do is skipped, so this is safe to re-run.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/make-review-todos.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestMeta, interestTodos } = await import('../src/lib/db/schema');
  const { getActiveInterests } = await import('../src/lib/scoring/active-interests'); const ACTIVE = await getActiveInterests(); // the active list (code + admin overrides), not the raw SLIDERS
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { reviewCadence, CADENCE_LABEL, CADENCE_TODO_SOURCE, effortBand, stakesBand } = await import('../src/lib/scoring/planning');
  const meta = new Map((await db.select().from(interestMeta)).map((m) => [m.key, m]));
  const existing = await db.select().from(interestTodos);
  const have = new Set(existing.filter((t) => t.source === CADENCE_TODO_SOURCE && t.status !== 'done').map((t) => t.interestKey));
  const rows = ACTIVE.filter((s) => meta.get(s.key)?.evergreen != null).map((s) => ({ s, m: meta.get(s.key)! })).sort((a, b) => a.s.label.localeCompare(b.s.label));
  const by = { weekly: [] as typeof rows, monthly: [] as typeof rows, quarterly: [] as typeof rows, annually: [] as typeof rows };
  for (const r of rows) by[reviewCadence(r.m.evergreen as number)].push(r);
  const pad = (n: number) => String(n).padStart(2, '0');
  const due = (c: keyof typeof by, i: number) =>
    c === 'monthly' ? `2026-11-${pad(3 + i * 3)}` : c === 'quarterly' ? [`2026-11-${pad(3 + Math.floor(i / 3) * 3)}`, `2026-12-${pad(3 + Math.floor(i / 3) * 3)}`, `2027-01-${pad(3 + Math.floor(i / 3) * 3)}`][i % 3] : `2027-${pad(1 + Math.floor((i * 12) / by.annually.length))}-15`;
  let made = 0, skipped = 0;
  for (const c of ['weekly', 'monthly', 'quarterly', 'annually'] as const) {
    for (const [i, { s, m }] of by[c].entries()) {
      if (have.has(s.key)) { skipped++; continue; }
      const n = (m.planningNotes ?? {}) as { staleFirst?: string; reviewTrigger?: string };
      const stale = n.staleFirst ?? 'the interest data';
      const values = {
        interestKey: s.key,
        title: `${CADENCE_LABEL[c]} review: ${stale}`.slice(0, 200),
        detail: `Check what goes stale first for ${s.label}: ${stale}. Check early if: ${n.reviewTrigger ?? 'a major change is reported'}. Stakes ${m.stakes ?? '?'} (${m.stakes ? stakesBand(m.stakes) : 'not set'}); refresh effort ${m.refreshEffort ?? '?'} (${m.refreshEffort ? effortBand(m.refreshEffort) : 'not set'}). When the review is done, tick this item: the next one is created on its own. Open "Reasons to check" and give every reason a result: this item cannot be ticked done until each one has Checked, Changed or Does not apply.`,
        status: 'needs_you' as const,
        source: CADENCE_TODO_SOURCE,
        priority: (m.stakes ?? 0) >= 7 ? 1 : (m.stakes ?? 0) >= 4 ? 2 : 3,
        dueOn: due(c, i),
        repeatEvery: c === 'weekly' ? ('weekly' as const) : c,
      };
      made++;
      if (apply) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${s.key}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
    }
  }
  console.log(`${apply ? 'created' : 'would create'} ${made} review to-dos (${skipped} already had one); monthly ${by.monthly.length}, quarterly ${by.quarterly.length}, annually ${by.annually.length}, weekly ${by.weekly.length}`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
