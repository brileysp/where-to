// 14 Oct 2026 to-do cleanup. (1) Deletes open to-dos for interests with no Gemini pass yet, since a pass redoes those jobs
// (scope rewrites, score re-checks, N/A reasons). (2) Closes four to-dos that are already done. Writes a backup of every deleted row first.
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const APPLY = process.argv.includes('--apply');
// Interests that have had a Gemini pass (generated text exists). Their to-dos stay.
const HAS_PASS = new Set(['birding', 'diving', 'safari', 'whaleWatching', 'wildlifeViewing', 'surfing', 'hiking']);
// Not fixed by regenerating text, so they stay even though the interest has no pass.
const KEEP_TITLES = [/^Decide whether Kilimanjaro stays/, /^Find a second source with monthly wind statistics/];
const CLOSE: Array<{ interestKey: string; title: RegExp; note: string }> = [
  { interestKey: 'surfing', title: /^Send 15 former N\/A places to Gemini/, note: 'All 15 were sent to Gemini in the v5 surfing run (13 Oct 2026) and the drafts are staged for review.' },
  { interestKey: 'surfing', title: /^Add N\/A reasons for the 15 places marked N\/A/, note: 'Obsolete: those 15 places are no longer N/A for surfing; they have staged drafts. Applying the drafts clears the N/A flag.' },
  { interestKey: 'wildlifeViewing', title: /^Replace "Mixed" in how you watch/, note: '"How you watch" became a multi-select on 12 Oct 2026 (see docs/backups/wildlife-how-watch-before-multi-2026-10-12.json).' },
  { interestKey: 'whaleWatching', title: /^Move region to just after place name/, note: 'The Future places table now shows Region right after the name, for every interest.' },
];
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { interestTodos } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const open = (await db.select().from(interestTodos)).filter((t) => t.status !== 'done');
  const del = open.filter((t) => t.interestKey !== '_site' && !HAS_PASS.has(t.interestKey) && !KEEP_TITLES.some((r) => r.test(t.title)));
  const closing = open.flatMap((t) => { const c = CLOSE.find((c) => c.interestKey === t.interestKey && c.title.test(t.title)); return c ? [{ t, note: c.note }] : []; });
  const byKind = (re: RegExp) => del.filter((t) => re.test(t.title)).length;
  console.log(`open ${open.length}; to delete ${del.length} (N/A reasons ${byKind(/^Add N\/A reasons/)}, re-check scores ${byKind(/^Re-check/)}, rewrite scope ${byKind(/^Rewrite/)}, other ${del.length - byKind(/^Add N\/A reasons|^Re-check|^Rewrite/)}); to close ${closing.length}`);
  for (const t of del.filter((t) => !/^Add N\/A reasons|^Re-check|^Rewrite/.test(t.title))) console.log(`  other: [${t.interestKey}] ${t.title}`);
  if (!APPLY) { console.log('dry run; pass --apply'); process.exit(0); }
  writeFileSync(join(__dirname, '..', 'docs', 'backups', 'todos-deleted-2026-10-14.json'), JSON.stringify(del, null, 1));
  for (const t of del) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: t.id, action: 'delete', before: t, after: null, write: (tx) => tx.delete(interestTodos).where(eq(interestTodos.id, t.id)) });
  for (const { t, note } of closing) {
    const set = { detail: `${t.detail}\n\nClosed 14 Oct 2026: ${note}`, status: 'done' as const, doneAt: new Date(), updatedAt: new Date() };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: t.id, action: 'update', before: t, after: { ...t, ...set }, write: (tx) => tx.update(interestTodos).set(set).where(eq(interestTodos.id, t.id)).returning() });
  }
  console.log(`deleted ${del.length}, closed ${closing.length}`);
  process.exit(0);
})();
