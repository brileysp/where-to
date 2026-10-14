// Writes the 13 Oct 2026 "does the current text already fit the widened place?" check into the rewrite to-dos.
//  - A (already works): the to-do is closed with the reason.
//  - B / C / N: stays open, with the verdict and reason added to its notes.
//  - The four Northern Tanzania to-dos get linked to the place and set to close when a generation is applied.
// Safe to re-run: a to-do that already has the note is skipped.
//
// Usage: npx tsx scripts/apply-scope-text-check.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';

for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
}

const LABEL: Record<string, string> = { A: 'The current text already works for the widened place', B: 'In between: not wrong, but leaves out a real part of the new place', C: 'Clearly about the old, narrower place', N: 'No text to judge' };
const MARK = 'Text check 13 Oct 2026';

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestTodos } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const verdicts = JSON.parse(readFileSync(join(__dirname, 'data', 'scope-text-check-2026-10-13.json'), 'utf8')) as Array<[string, string, string, string]>;
  const byKey = new Map(verdicts.map((v) => [`${v[0]}|${v[1]}`, v]));
  const todos = (await db.select().from(interestTodos)).filter((t) => t.status !== 'done' && /^Rewrite .* for its (wider|narrower|new) scope/.test(t.title));
  let closed = 0, noted = 0, linked = 0, skipped = 0;
  const unmatched: string[] = [];
  for (const t of todos) {
    const pid = t.placeId ?? (t.title.includes('Northern Tanzania') ? 'tanzania' : null);
    const v = pid ? byKey.get(`${pid}|${t.interestKey}`) : undefined;
    if (!pid || !v) { unmatched.push(`${t.interestKey}: ${t.title}`); continue; }
    if (t.detail.includes(MARK)) { skipped++; continue; }
    const [, , verdict, reason] = v;
    const today = new Date();
    const note = verdict === 'A'
      ? `${MARK}: closed. ${LABEL.A}. ${reason}`
      : `${MARK}: ${LABEL[verdict]}. ${reason}`;
    const detail = t.detail ? `${t.detail}\n\n${note}` : note;
    const needsLink = !t.placeId;
    const set = { detail, updatedAt: today, ...(verdict === 'A' ? { status: 'done' as const, doneAt: today } : {}), ...(needsLink ? { placeId: pid, closeOnApply: true } : {}) };
    if (verdict === 'A') closed++; else noted++;
    if (needsLink) linked++;
    if (apply) {
      const after = { ...t, ...set };
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: t.id, action: 'update', before: t, after, write: (tx) => tx.update(interestTodos).set(set).where(eq(interestTodos.id, t.id)).returning() });
    }
  }
  console.log(`${apply ? 'did' : 'would do'}: closed ${closed}, noted ${noted}, linked ${linked}, already done ${skipped}; unmatched ${unmatched.length}`);
  if (unmatched.length) console.log(unmatched.join('\n'));
  process.exit(0);
})();
