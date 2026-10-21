// 21 Oct 2026: the owner's wording fixes (same number of answers, so the saved column rules still line up), and approvals given in chat.
// Reworded questions keep their approval because the owner agreed the new wording. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/wording-and-approvals-oct21.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

const FIXES: Array<[string, string, string, string]> = [
  ['surfing', 'q4', 'I don’t want you wear a wetsuit', 'I don’t want to wear a wetsuit'],
  ['surfing', 'q4', 'A 3 mm wetsuit ok', 'A 3 mm wetsuit is fine'],
  ['safari', 'q2', 'Lots of vehicles around is ok if the sighting is great', 'Lots of vehicles around is okay if the sighting is great'],
  ['wildlifeViewing', 'q2', 'A balance, some waiting ok', 'A balance, some waiting is okay'],
  ['wildlifeViewing', 'q2', 'Ok with waiting or hiking for hours for one special animal', 'Okay with waiting or hiking for hours for one special animal'],
  ['fineDining', 'q3', '$300 a person or more', '$300 or more per person'],
];
const APPROVE: Array<[string, string]> = [['safari', 'q1'], ['religiousSites', 'q2']];

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestQuestions } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const where = (ik: string, qk: string) => and(eq(interestQuestions.interestKey, ik), eq(interestQuestions.questionKey, qk));
  for (const [ik, qk] of [...new Set(FIXES.map((f) => `${f[0]}|${f[1]}`))].map((s) => s.split('|') as [string, string])) {
    const [q] = await db.select().from(interestQuestions).where(where(ik, qk));
    let options = [...q.options];
    const norm = (t: string) => t.replace(/[’']/g, "'");
    for (const [fi, fq, from, to] of FIXES) if (fi === ik && fq === qk) { if (options.some((o) => norm(o) === norm(to))) continue; if (!options.some((o) => norm(o) === norm(from))) throw new Error(`${ik}.${qk}: no answer "${from}"`); options = options.map((o) => (norm(o) === norm(from) ? to : o)); }
    console.log(`${ik}.${qk}: ${q.options.filter((o, i) => o !== options[i]).length} answers reworded`);
    if (apply) await db.update(interestQuestions).set({ options, updatedBy: 'Claude (wording fixes the owner approved, 21 Oct 2026)', updatedAt: new Date() }).where(where(ik, qk));
  }
  for (const [ik, qk] of APPROVE) {
    console.log(`approve ${ik}.${qk}`);
    if (apply) await db.update(interestQuestions).set({ approvedBy: 'brileysp@gmail.com (approved in chat, 21 Oct 2026; recorded by Claude)', approvedAt: new Date() }).where(where(ik, qk));
  }
  // Any other "ok" left in answers (informational).
  const all = await db.select().from(interestQuestions);
  for (const q of all) for (const o of q.options) if (/\bok\b/i.test(o)) console.log(`still has "ok": ${q.interestKey}.${q.questionKey} "${o}"`);
  if (!apply) console.log('dry run');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
