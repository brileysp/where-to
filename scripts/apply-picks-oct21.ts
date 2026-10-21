// Applies the owner's picks from the Chips and Questions page (reviewed in three passes, 20 to 21 Oct 2026) to the admin tables.
// The page's state was turned into scripts/data/apply-picks-oct21.json (approved chips and questions per interest, with the chips that open each question).
//   Chips: approved ones are created as draft chips that wait on a column (or approved, if they already exist); renamed ones get the new name.
//          Rejected DRAFT chips and superseded unapproved drafts are deleted. Rejected LIVE chips are never deleted here: they are listed for a decision.
//   Questions: approved ones are created or updated (wording, answers, kind, picks) and marked approved; questions that were not approved are deleted
//          (none of them is live: onboarding does not ask them yet). The chips that open each question go into interest_question_chips.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-picks-oct21.ts [--apply]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

const OWNER = 'brileysp@gmail.com (picked on the proposals page, 20-21 Oct 2026; recorded by Claude)';
type PChip = { key: string; label: string; origLabel: string; was?: string | null; needs: boolean; desc: string; at?: string | null };
type PQ = { pageId: string; text: string; options: string[]; kind: 'lean' | 'limit'; maxPicks: number; status: string; reads: string; when: string[]; at?: string | null; selected: boolean };
type PI = { label: string; chips: PChip[]; rejectedChips: Array<{ key: string; label: string }>; undecidedChips: Array<{ key: string; label: string }>; questions: PQ[]; warnings: string[] };

(async () => {
  const apply = process.argv.includes('--apply');
  const plan = JSON.parse(readFileSync(join(__dirname, 'data', 'apply-picks-oct21.json'), 'utf8')) as { interests: Record<string, PI> };
  const { db } = await import('../src/lib/db/client');
  const { interestChips, interestQuestions, interestQuestionChips, placeChipOverrides } = await import('../src/lib/db/schema');
  const { and, eq, inArray } = await import('drizzle-orm');
  const keys = Object.keys(plan.interests);
  const dbChips = await db.select().from(interestChips).where(inArray(interestChips.interestKey, keys));
  const dbQs = await db.select().from(interestQuestions).where(inArray(interestQuestions.interestKey, keys));
  const at = (s?: string | null) => (s ? new Date(s) : new Date());

  const ops = { chipInsert: [] as any[], chipUpdate: [] as any[], chipDelete: [] as any[], liveRejected: [] as string[], keptExtra: [] as string[], qInsert: [] as any[], qUpdate: [] as any[], qDelete: [] as any[], links: [] as any[] };
  const qMap: Record<string, string> = {};

  for (const [ik, p] of Object.entries(plan.interests)) {
    const mine = dbChips.filter((c) => c.interestKey === ik);
    const norm = (x?: string | null) => (x ?? '').trim().toLowerCase();
    // A chip is found by its key, or by its name (the owner has renamed some chips in the admin, which does not change their key).
    const find = (key: string, labels: Array<string | null | undefined>) => mine.find((c) => c.chipKey === key) ?? mine.find((c) => labels.some((l) => l && norm(c.label) === norm(l)));
    const keyOf = new Map<string, string>(); // plan key -> database key
    const matched = new Set<string>();
    p.chips.forEach((c, i) => {
      const row = find(c.key, [c.label, c.origLabel, c.was]);
      if (row) { keyOf.set(c.key, row.chipKey); matched.add(row.chipKey); }
      else keyOf.set(c.key, c.key);
      if (!row) ops.chipInsert.push({ interestKey: ik, chipKey: c.key, label: c.label, sortOrder: i + 1, status: 'draft', drivers: [], needsColumn: `New column: ${c.desc || 'to be decided'}`, approvedBy: OWNER, approvedAt: at(c.at), updatedBy: 'Claude (owner picks, 21 Oct 2026)' });
      else {
        const patch: any = {};
        if (row.label !== c.label) patch.label = c.label;
        if (row.sortOrder !== i + 1) patch.sortOrder = i + 1;
        if (!row.approvedAt) { patch.approvedBy = OWNER; patch.approvedAt = at(c.at); }
        if (Object.keys(patch).length) ops.chipUpdate.push({ interestKey: ik, chipKey: row.chipKey, label: row.label, patch });
      }
    });
    const rejectedKeys = new Set(p.rejectedChips.map((c) => find(c.key, [c.label])?.chipKey).filter(Boolean) as string[]);
    const undecidedKeys = new Set(p.undecidedChips.map((c) => find(c.key, [c.label])?.chipKey).filter(Boolean) as string[]);
    for (const row of mine) {
      if (matched.has(row.chipKey)) continue;
      if (rejectedKeys.has(row.chipKey)) { if (row.status === 'live') ops.liveRejected.push(`${ik}: ${row.label}`); else ops.chipDelete.push({ interestKey: ik, chipKey: row.chipKey, label: row.label, why: 'rejected' }); continue; }
      if (undecidedKeys.has(row.chipKey)) { ops.keptExtra.push(`${ik}: ${row.label} (undecided)`); continue; }
      if (row.status !== 'live' && !row.approvedAt) ops.chipDelete.push({ interestKey: ik, chipKey: row.chipKey, label: row.label, why: 'superseded' });
      else ops.keptExtra.push(`${ik}: ${row.label} (${row.status}${row.approvedAt ? ', approved' : ''})`);
    }

    const qrows = dbQs.filter((q) => q.interestKey === ik);
    const used = new Set<string>();
    let next = qrows.reduce((m, r) => Math.max(m, Number(r.questionKey.replace(/^q/, '')) || 0), 0);
    p.questions.forEach((q, i) => {
      const suffix = q.pageId.split('__')[1];
      let row = q.selected ? qrows.find((r) => r.questionKey === suffix) : undefined;
      const key = row ? row.questionKey : `q${++next}`;
      used.add(key); qMap[q.pageId] = key;
      const note = row ? row.note : q.reads;
      const next_ = { text: q.text, options: q.options, maxPicks: q.maxPicks, kind: q.kind, sortOrder: i + 1 };
      if (!row) ops.qInsert.push({ interestKey: ik, questionKey: key, ...next_, columns: [], note, approvedBy: OWNER, approvedAt: at(q.at), updatedBy: 'Claude (owner picks, 21 Oct 2026)' });
      else {
        const changed = row.text !== q.text || JSON.stringify(row.options) !== JSON.stringify(q.options) || row.kind !== q.kind || row.maxPicks !== q.maxPicks || row.sortOrder !== i + 1 || !row.approvedAt;
        if (changed) ops.qUpdate.push({ interestKey: ik, questionKey: key, label: row.text, set: { ...next_, approvedBy: row.approvedAt && row.text === q.text ? row.approvedBy : OWNER, approvedAt: row.approvedAt && row.text === q.text ? row.approvedAt : at(q.at) } });
      }
      for (const ck of q.when) ops.links.push({ interestKey: ik, questionKey: key, chipKey: keyOf.get(ck) ?? ck });
    });
    for (const r of qrows) if (!used.has(r.questionKey)) ops.qDelete.push({ interestKey: ik, questionKey: r.questionKey, text: r.text });
  }

  console.log(`chips: ${ops.chipInsert.length} to create, ${ops.chipUpdate.length} to update, ${ops.chipDelete.length} to delete (rejected ${ops.chipDelete.filter((x) => x.why === 'rejected').length}, superseded ${ops.chipDelete.filter((x) => x.why === 'superseded').length})`);
  console.log(`questions: ${ops.qInsert.length} to create, ${ops.qUpdate.length} to update, ${ops.qDelete.length} to delete; ${ops.links.length} chip links`);
  console.log('LIVE chips you rejected (not deleted, need your word):', ops.liveRejected.length ? '\n  ' + ops.liveRejected.join('\n  ') : 'none');
  console.log('kept but not in your picks:', ops.keptExtra.length ? '\n  ' + ops.keptExtra.join('\n  ') : 'none');
  console.log('chip deletes:', ops.chipDelete.map((x) => `${x.interestKey}: ${x.label} [${x.why}]`).join(' | '));
  console.log('question deletes:', ops.qDelete.map((x) => `${x.interestKey}.${x.questionKey}`).join(', ') || 'none');
  if (!apply) { console.log('dry run: pass --apply to write'); process.exit(0); }

  writeFileSync(join(__dirname, 'data', 'apply-picks-oct21-map.json'), JSON.stringify(qMap, null, 1));
  await db.transaction(async (tx) => {
    for (const d of ops.qDelete) await tx.delete(interestQuestions).where(and(eq(interestQuestions.interestKey, d.interestKey), eq(interestQuestions.questionKey, d.questionKey)));
    for (const c of ops.chipInsert) await tx.insert(interestChips).values(c);
    for (const u of ops.chipUpdate) await tx.update(interestChips).set({ ...u.patch, updatedBy: 'Claude (owner picks, 21 Oct 2026)', updatedAt: new Date() }).where(and(eq(interestChips.interestKey, u.interestKey), eq(interestChips.chipKey, u.chipKey)));
    for (const q of ops.qInsert) await tx.insert(interestQuestions).values(q);
    for (const u of ops.qUpdate) await tx.update(interestQuestions).set({ ...u.set, updatedBy: 'Claude (owner picks, 21 Oct 2026)', updatedAt: new Date() }).where(and(eq(interestQuestions.interestKey, u.interestKey), eq(interestQuestions.questionKey, u.questionKey)));
    for (const d of ops.chipDelete) {
      await tx.delete(placeChipOverrides).where(and(eq(placeChipOverrides.interestKey, d.interestKey), eq(placeChipOverrides.chipKey, d.chipKey)));
      await tx.delete(interestChips).where(and(eq(interestChips.interestKey, d.interestKey), eq(interestChips.chipKey, d.chipKey)));
    }
    for (const l of ops.links) await tx.insert(interestQuestionChips).values({ ...l, createdBy: 'Claude (owner picks, 21 Oct 2026)' }).onConflictDoNothing();
  });
  console.log('applied');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
