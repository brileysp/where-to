// 22 Oct 2026: checks the new per-place tables (what the new onboarding uses) give exactly the same match as the original route, on the real
// data, and prints how big the tables are. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/check-match-tables-oct22.ts
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

(async () => {
  const { db } = await import('../src/lib/db/client');
  const s = await import('../src/lib/db/schema');
  const { factDefsFor } = await import('../src/lib/admin/interest-pages/config');
  const { interestMatchFor } = await import('../src/lib/scoring/interestMatch');
  const { matchFromFits } = await import('../src/lib/scoring/matchTable');
  const { getMatchSetups, getMatchFits } = await import('../src/lib/db/queries/match-data');
  const setups = await getMatchSetups();
  const keys = Object.keys(setups);
  console.log('Interests with approved, mapped questions:', keys.map((k) => `${k} (${setups[k].questions.length} questions, ${setups[k].content.chips.length} chips)`).join('; '));
  const fits = await getMatchFits(keys);
  console.log('Table size (JSON bytes):', Object.fromEntries(keys.map((k) => [k, JSON.stringify(fits[k]).length])), 'places per interest:', Object.fromEntries(keys.map((k) => [k, Object.keys(fits[k]).length])));
  const [chipRows, qRows, linkRows, factRows] = await Promise.all([db.select().from(s.interestChips), db.select().from(s.interestQuestions), db.select().from(s.interestQuestionChips), db.select().from(s.placeInterestFacts)]);
  let compared = 0, differ = 0;
  for (const k of keys) {
    const defs = factDefsFor(k);
    const chips = chipRows.filter((c) => c.interestKey === k && c.status === 'live').map((c) => ({ key: c.chipKey, label: c.label, live: true, drivers: c.drivers }));
    const questions = qRows.filter((q) => q.interestKey === k).map((q) => ({ key: q.questionKey, kind: q.kind, whenChips: linkRows.filter((l) => l.interestKey === k && l.questionKey === q.questionKey && !l.suggested).map((l) => l.chipKey), fitRule: q.fitRule ?? null, missMessage: q.missMessage, approved: !!q.approvedAt }));
    // Try a spread of travelers: nothing, every first answer, every last answer, each chip alone with all first answers.
    const askable = setups[k].questions;
    const answerSets = [
      {} as Record<string, number[]>,
      Object.fromEntries(askable.map((q) => [q.key, [0]])),
      Object.fromEntries(askable.map((q) => [q.key, [q.options.length - 1]])),
      Object.fromEntries(askable.map((q) => [q.key, [0, Math.min(1, q.options.length - 1)].slice(0, q.maxPicks)])),
    ];
    const tickSets: string[][] = [[], ...chips.map((c) => [c.key]), chips.slice(0, 2).map((c) => c.key)];
    for (const f of factRows.filter((x) => x.interestKey === k)) {
      for (const ticked of tickSets) for (const answers of answerSets) {
        const a = interestMatchFor({ chips, questions, ticked, answers, facts: f.facts as never, defs });
        const b = matchFromFits({ content: setups[k].content, fits: fits[k][f.placeId], ticked, answers });
        compared++;
        // Numbers may differ in the last binary digit (the questions are read in a different order), and reasons that tie on cost may be cut or ordered differently, so compare with a tiny tolerance, compare costs not wording, and ignore the order of matches.
        const close = (x: number, y: number) => Math.abs(x - y) < 1e-9;
        const same = (x: any, y: any) => close(x.factor, y.factor) && x.checked === y.checked && JSON.stringify([...x.matches].sort()) === JSON.stringify([...y.matches].sort()) && x.reasons.length === y.reasons.length && [...x.reasons].map((r: any) => r.cost).sort().every((c: number, n: number) => close(c, [...y.reasons].map((r: any) => r.cost).sort()[n]));
        if (!same(a, b)) { differ++; if (differ < 5) console.log('DIFF', k, f.placeId, ticked, answers, a, b); }
      }
    }
  }
  console.log(`Compared ${compared} place/traveler combinations; ${differ} differ.`);
  process.exit(differ ? 1 : 0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
