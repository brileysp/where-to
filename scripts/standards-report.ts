// 14 Nov 2026: the acceptance run for a batch of authored cells (a Gemini results file), judged where the owner reads it: each cell, then each interest's batch on its own, worst first.
// It runs every automatic standard (docs/standards.md) and then lists the judgement standards I must answer, with evidence, in the hand-off. Reads only.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/standards-report.ts --results=scripts/data/<results>.json [--interest=a,b]
// Exit code 1 when a blocking item is found (a 'fix' text rule, a clumped cell, an uneven batch, a blocking old rule).
import { flatAllYear, readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { installLabelFilter } = await import('../src/lib/places/console-labels'); await installLabelFilter(); // standard D03: a report never prints a place key
  await (await import('../src/lib/places/renamed-sync')).syncRenamedPlacesFile(); // the old-name check reads the label history
  const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  const file = arg('results'); if (!file) { console.log('Usage: --results=file.json [--interest=a,b]'); process.exit(1); }
  const only = arg('interest')?.split(',');
  const { TEXT_RULES, scanText, scanStructure, scanSky, flatAllYear } = await import('../src/lib/authoring/rules'); const { oldRuleHits } = await import('../src/lib/authoring/old-rules');
  const { checkBatch, describeBatchCheck } = await import('../src/lib/gemini/clump'); const { STANDARDS } = await import('../src/lib/authoring/standards');
  const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows');
  const rows = (await getPrimaryPlaceRows()) as any[]; const byId = new Map(rows.map((r) => [r.id, r]));
  const results = (JSON.parse(readFileSync(file, 'utf8')) as any[]).filter((r) => r.gemini?.applicable && (!only || only.includes(r.k)));
  const kindOf = new Map(TEXT_RULES.map((r) => [r.id, r.kind])); let blocking = 0;
  type Item = { cell: string; sev: 'BLOCKS' | 'review'; what: string; worst: number };
  const items: Item[] = [];
  for (const r of results) {
    const g = r.gemini; const cell = `${r.k}: ${byId.get(r.id)?.name ?? r.id}`; /* 18 Nov 2026: the owner reads the label, never the key (standard D03) */ const texts = g.blurbs.map((b: any) => b.text);
    const offerCount = ([g.overview, ...texts].join(' ').match(/\boffer(s|ing)?\b/gi) ?? []).length; // W02: an occasional "offers" is fine, so it is only listed when leaned on (3 or more)
    for (const h of scanText(g.overview, texts, { drinks: r.k === 'wineSpirits' || r.k === 'coffeeTea', sky: r.k === 'stargazing', casual: r.k === 'sunbathing' || r.k === 'scenicLandscapes' }).filter((x) => x !== 'offers' || offerCount >= 3)) items.push({ cell, what: `text rule ${h}`, sev: kindOf.get(h) === 'fix' ? 'BLOCKS' : 'review', worst: kindOf.get(h) === 'fix' ? 3 : 1 });
    for (const h of scanStructure(g.blurbs.map((b: any) => ({ months: b.months, text: b.text })), g.monthly_scores)) items.push({ cell, what: `structure ${h}`, sev: h === 'wideGroup' || h === 'nonNeighbors' || h === 'groupTalk' ? 'BLOCKS' : 'review', worst: h === 'wideGroup' || h === 'nonNeighbors' || h === 'groupTalk' ? 3 : 1 });
    if (r.k === 'stargazing' && typeof byId.get(r.id)?.latitude === 'number') for (const h of scanSky(g.overview, g.blurbs.map((b: any) => ({ months: b.months, text: b.text })), byId.get(r.id).latitude)) items.push({ cell, what: `sky ${h}`, sev: 'BLOCKS', worst: 3 }); // W25, W26
    if (r.k === 'scenicLandscapes' && flatAllYear(g.monthly_scores)) items.push({ cell, what: `flat all year at ${g.monthly_scores[0]}: say why neither the look nor the comfort of seeing it ever changes`, sev: 'review', worst: 1 }); // S05, 18 Nov 2026
    for (const h of oldRuleHits(g, r.k, r.id, byId.get(r.id)?.countryCode)) items.push({ cell, what: `old rule ${h.id}`, sev: h.blocks ? 'BLOCKS' : 'review', worst: h.blocks ? 3 : 1 });
  }
  for (const k of new Set(results.map((r) => r.k))) {
    const series = Object.fromEntries(results.filter((r) => r.k === k).map((r) => [r.id, r.gemini.monthly_scores as number[]])); const c = checkBatch(series);
    console.log(...describeBatchCheck(k, c).map((l) => l + '\n'));
    for (const x of c.clumpedCells) items.push({ cell: `${k}: ${byId.get(x.id)?.name ?? x.id}`, what: `clumped on .0/.5 (${x.clump.round} of ${x.clump.runs} runs)`, sev: 'BLOCKS', worst: 4 });
    if (!c.batch.even) items.push({ cell: `${k} (whole batch)`, what: 'last digits uneven on the batch alone', sev: 'BLOCKS', worst: 5 });
  }
  { const { staleScopeRows, describeStale } = await import('../src/lib/places/scope-stale'); const inFile = new Set(results.map((r) => r.id)); // 18 Nov 2026 (D03): data made for an older scope of the place
    for (const x of await staleScopeRows()) if (inFile.has(x.key)) items.push({ cell: `${[...new Set(results.map((r) => r.k))].join(', ')}: ${x.label}`, what: `made for an older scope: ${describeStale(x)}`, sev: 'review', worst: 2 }); }
  items.sort((a, b) => b.worst - a.worst || a.cell.localeCompare(b.cell));
  blocking = items.filter((i) => i.sev === 'BLOCKS').length;
  console.log(`\n${results.length} cells checked. Worst first (${blocking} blocking, ${items.length - blocking} to review):`);
  for (const i of items) console.log(`  ${i.sev === 'BLOCKS' ? 'BLOCKS' : 'review'}  ${i.cell.padEnd(40)} ${i.what}`);
  if (!items.length) console.log('  nothing found by the automatic standards');
  console.log('\nJudgement standards to answer in the hand-off, each with evidence (no code can decide these):');
  for (const s of STANDARDS.filter((x) => x.judgement && ['cell', 'batch', 'interest', 'page', 'process'].includes(x.level))) console.log(`  ${s.id} ${s.title}\n      evidence: ${s.judgement}`);
  console.log('\nNot checked by this report: facts against sources (F01 to F03), the rank checks, and anything outside the file given.');
  process.exit(blocking ? 1 : 0);
})();
