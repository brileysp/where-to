// 21 Oct 2026: runs the drafted question-to-column rules (src/lib/onboarding/question-fit-rules.ts) over every place with data and counts, per answer,
// how many places match fully, partly, miss or have no data. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/report-question-fit-oct21.ts out.json
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, interestQuestions, interestChips, interestQuestionChips } = await import('../src/lib/db/schema');
  const { QUESTION_FIT_RULES, PROPOSED_MISS_MESSAGES } = await import('../src/lib/onboarding/question-fit-rules');
  const { answerRuleFit, describeAnswerRule } = await import('../src/lib/onboarding/question-fit');
  const { factDefsFor } = await import('../src/lib/admin/interest-pages/config');
  const facts = await db.select().from(placeInterestFacts);
  const qs = await db.select().from(interestQuestions);
  const chips = await db.select().from(interestChips);
  const links = await db.select().from(interestQuestionChips);
  const out: any[] = [];
  const seen = new Set<string>();
  for (const [id, rule] of Object.entries(QUESTION_FIT_RULES)) {
    const [ik, qk] = id.split('.');
    const q = qs.find((x) => x.interestKey === ik && x.questionKey === qk);
    if (!q) throw new Error('no question ' + id);
    if (q.options.length !== rule.answers.length) throw new Error(`${id}: ${q.options.length} options but ${rule.answers.length} rule entries`);
    seen.add(id);
    const defs = factDefsFor(ik);
    const rows = facts.filter((f) => f.interestKey === ik);
    const answers = q.options.map((opt, i) => {
      const a = rule.answers[i];
      const tally = { full: 0, part: 0, miss: 0, none: 0 };
      if (a) for (const r of rows) { const f = answerRuleFit(a, defs, r.facts as any); if (f === null) tally.none++; else if (f >= 0.999) tally.full++; else if (f <= 0.001) tally.miss++; else tally.part++; }
      return { option: opt, rule: describeAnswerRule(a, defs), check: !!a, ...tally };
    });
    out.push({ id, interest: ik, qkey: qk, text: q.text, kind: q.kind, maxPicks: q.maxPicks, places: rows.length, miss: PROPOSED_MISS_MESSAGES[id] ?? '', links: links.filter((l) => l.interestKey === ik && l.questionKey === qk && !l.suggested).map((l) => chips.find((c) => c.interestKey === ik && c.chipKey === l.chipKey)?.label), answers });
  }
  // approved questions of these seven interests that have no rule
  const missing = qs.filter((q) => ['hiking','birding','safari','wildlifeViewing','diving','whaleWatching','surfing'].includes(q.interestKey) && !seen.has(`${q.interestKey}.${q.questionKey}`)).map((q) => `${q.interestKey}.${q.questionKey}`);
  writeFileSync(process.argv[2], JSON.stringify({ out, missing }, null, 1));
  console.log('rules', out.length, 'questions without a rule:', missing);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
