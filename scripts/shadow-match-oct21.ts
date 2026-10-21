// 21 Oct 2026: a "what would change" report for the new matching, run offline on sample travelers. Nothing is saved or shown to anyone.
// For each sample traveler it applies their chips and answers to one interest, place by place, and lists the biggest drops, the reason chips
// they would get, and how the interest's top ten changes. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/shadow-match-oct21.ts [out.md]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

interface Persona { name: string; interest: string; ticked: string[]; answers: Record<string, number[]> }
const PERSONAS: Persona[] = [
  { name: 'Hut-to-hut hiker who stays low and books late', interest: 'hiking', ticked: ['hut-to-hut'], answers: { q3: [0], q4: [0], q2: [0] } },
  { name: 'Open Water diver who wants wrecks, calm water and a 3 mm suit', interest: 'diving', ticked: ['wrecks'], answers: { q1: [1], q2: [0], q3: [1], q4: [1] } },
  { name: 'Safari-goer after leopard and wild dog, avoiding malaria', interest: 'safari', ticked: [], answers: { q1: [0, 5], q3: [0], q4: [0] } },
  { name: 'Learning surfer who wants friendly lineups, sand bottoms and a spring suit', interest: 'surfing', ticked: [], answers: { q1: [1], q3: [0], q4: [1], q5: [0] } },
  { name: 'Birder after endemics, no guide, mostly from the car', interest: 'birding', ticked: ['endemic-species'], answers: { q2: [0], q3: [0], q4: [0] } },
  { name: 'Queasy whale watcher who wants a near-sure sighting on a small boat', interest: 'whaleWatching', ticked: [], answers: { q1: [2], q2: [0], q3: [0] } },
];

(async () => {
  const { db } = await import('../src/lib/db/client');
  const s = await import('../src/lib/db/schema');
  const { factDefsFor } = await import('../src/lib/admin/interest-pages/config');
  const { interestMatchFor } = await import('../src/lib/scoring/interestMatch');
  const [chipRows, qRows, linkRows, factRows, placeRows] = await Promise.all([
    db.select().from(s.interestChips), db.select().from(s.interestQuestions), db.select().from(s.interestQuestionChips), db.select().from(s.placeInterestFacts),
    db.select({ id: s.places.id, name: s.places.name, base: s.places.baseScores, na: s.places.naSliders }).from(s.places),
  ]);
  const out: string[] = ['# Shadow match report (21 Oct 2026)', '', 'Offline, on sample travelers. The "original" score is the place\'s base score for the interest; "new" is original times what survives. Nothing here is live.', ''];
  for (const p of PERSONAS) {
    const defs = factDefsFor(p.interest);
    const chips = chipRows.filter((c) => c.interestKey === p.interest).map((c) => ({ key: c.chipKey, label: c.label, live: c.status === 'live', drivers: c.drivers }));
    const questions = qRows.filter((q) => q.interestKey === p.interest).map((q) => ({ key: q.questionKey, kind: q.kind, whenChips: linkRows.filter((l) => l.interestKey === p.interest && l.questionKey === q.questionKey && !l.suggested).map((l) => l.chipKey), fitRule: q.fitRule ?? null, missMessage: q.missMessage, approved: !!q.approvedAt }));
    const unapproved = qRows.filter((q) => q.interestKey === p.interest && !q.approvedAt).map((q) => q.questionKey);
    const rows = factRows.filter((f) => f.interestKey === p.interest).flatMap((f) => {
      const pl = placeRows.find((x) => x.id === f.placeId);
      if (!pl || pl.na.includes(p.interest)) return [];
      const orig = (pl.base as Record<string, number>)[p.interest];
      if (typeof orig !== 'number') return [];
      const m = interestMatchFor({ chips, questions, ticked: p.ticked, answers: p.answers, facts: f.facts as any, defs });
      return [{ name: pl.name, orig, now: orig * m.factor, factor: m.factor, reasons: m.reasons.map((r) => r.message), matches: m.matches, checked: m.checked }];
    });
    const lowered = rows.filter((r) => r.factor < 0.999);
    const top = (k: 'orig' | 'now') => [...rows].sort((a, b) => b[k] - a[k]).slice(0, 10).map((r) => r.name);
    const before = top('orig'), after = top('now');
    out.push(`## ${p.name}`, `Interest: ${p.interest}. Chips ticked: ${p.ticked.join(', ') || 'none'}. Answers: ${JSON.stringify(p.answers)}.${unapproved.length ? ` Not counted (not approved): ${unapproved.join(', ')}.` : ''}`, '');
    out.push(`${rows.length} places scored; ${lowered.length} lowered (${Math.round((lowered.length / Math.max(1, rows.length)) * 100)}%); average drop among them ${(lowered.reduce((n, r) => n + (1 - r.factor), 0) / Math.max(1, lowered.length) * 100).toFixed(0)}%.`, '');
    out.push('Biggest drops:', '', '| Place | Original | New | Reasons |', '|---|---|---|---|');
    for (const r of [...lowered].sort((a, b) => (b.orig - b.now) - (a.orig - a.now)).slice(0, 8)) out.push(`| ${r.name} | ${r.orig.toFixed(1)} | ${r.now.toFixed(1)} | ${r.reasons.join('; ') || '(small, no chip)'} |`);
    out.push('', `Top ten before: ${before.join(', ')}`, `Top ten after: ${after.join(', ')}`, `Left the top ten: ${before.filter((x) => !after.includes(x)).join(', ') || 'none'}`, '');
  }
  writeFileSync(process.argv[2] ?? join(__dirname, '..', 'docs', 'shadow-match-report-2026-10-21.md'), out.join('\n'));
  console.log(out.join('\n'));
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
