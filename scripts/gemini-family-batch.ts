// 31 Oct 2026: writes the text for every applicable place that has none, for the interests named, using the family directive (prompts/family-v1.md, prompts/_shared/authoring-core.md,
// scripts/data/family-scopes.json). Gemini is sent only the place. Results go to a JSON file for the checks and the owner's review; NOTHING is written to the database or the app.
// Cells already in --skip files (the sample runs) are not repeated. Stops at the budget cap and can be re-run to continue.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/gemini-family-batch.ts --interests=museumsArt,architecture --out=file.json --budget=10 [--concurrency=4] [--skip=a.json,b.json] [--dry]
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const KIND: Record<string, string> = { country: 'a whole country', region: 'a region', state_province: 'a state or province', island: 'an island or island group', city: 'a city', neighborhood: 'a neighborhood', national_park: 'a national park', wilderness_area: 'a wilderness area', coastal_area: 'a coastal area', day_trip: 'a day trip' };
const strip = (t: string) => t.replace(/<!--[\s\S]*?-->/g, '').trim();
(async () => {
  const interests = (arg('interests') ?? '').split(',').filter(Boolean);
  const out = arg('out'); const dry = process.argv.includes('--dry');
  if (!interests.length || (!out && !dry)) { console.log('Usage: --interests=a,b --out=file.json --budget=10 [--concurrency=4] [--skip=a.json,b.json] [--dry]'); process.exit(1); }
  const budget = Number(arg('budget') ?? '10'); const conc = Number(arg('concurrency') ?? '4');
  const root = join(__dirname, '..');
  const scopes = JSON.parse(readFileSync(join(__dirname, 'data', 'family-scopes.json'), 'utf8')) as Record<string, { title: string; interests: Record<string, { label: string; about: string; notCount: string; scope: string }> }>;
  const famOf = (k: string) => Object.keys(scopes).find((f) => scopes[f].interests[k]);
  for (const k of interests) if (!famOf(k)) throw new Error(`No family scope for ${k}`);
  const template = strip(readFileSync(join(root, 'prompts', 'family-v1.md'), 'utf8'));
  const core = strip(readFileSync(join(root, 'prompts', '_shared', 'authoring-core.md'), 'utf8'));
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { scorePlace } = await import('../src/lib/db/queries/places');
  const { generateLean, MODEL } = await import('../src/lib/gemini/client');
  const rows = await db.select().from(places);
  const done = new Set<string>();
  for (const f of (arg('skip') ?? '').split(',').filter(Boolean)) if (existsSync(f)) for (const r of JSON.parse(readFileSync(f, 'utf8'))) done.add(`${r.k}|${r.id}`);
  const results: any[] = out && existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : [];
  for (const r of results) done.add(`${r.k}|${r.id}`);
  const queue: Array<{ k: string; id: string }> = [];
  for (const k of interests) for (const r of rows) if (!r.naSliders.includes(k) && !((r.sliderOverview as Record<string, string> | null)?.[k]) && !done.has(`${k}|${r.id}`)) queue.push({ k, id: r.id });
  let spent = results.reduce((a, r) => a + r.cost, 0);
  console.log(`${queue.length} cells to write; already spent $${spent.toFixed(2)}; cap $${budget}`);
  const build = (k: string, id: string) => {
    const row = rows.find((r) => r.id === id)!; const fam = scopes[famOf(k)!];
    const table = ['| Interest | It is about | Does not count toward it |', '|---|---|---|', ...Object.values(fam.interests).map((i) => `| ${i.label} | ${i.about} | ${i.notCount} |`)].join('\n');
    const place = `${row.name} (${KIND[row.placeType ?? ''] ?? 'a place'}; ${row.region}${row.countryCode ? `, ${row.countryCode}` : ''})`;
    return { row, prompt: template.replace('{{PLACE}}', place).replace(/\{\{LABEL\}\}/g, fam.interests[k].label).replace('{{SCOPE}}', fam.interests[k].scope).replace('{{FAMILY_TABLE}}', table).replace('{{CORE}}', core) };
  };
  if (dry) { const q = queue[0]; console.log(build(q.k, q.id).prompt.length, 'chars for the first prompt;', queue.length, 'cells'); process.exit(0); }
  let inflight = 0, stop = false, completed = 0, failed = 0;
  const saveEvery = () => writeFileSync(out!, JSON.stringify(results));
  const worker = async () => {
    while (!stop) {
      if (spent + inflight * 0.03 >= budget) { stop = true; break; }
      const j = queue.shift(); if (!j) break;
      inflight++;
      try {
        const { row, prompt } = build(j.k, j.id);
        let r: Awaited<ReturnType<typeof generateLean>> | null = null;
        for (let a = 0; a < 3 && !r; a++) { try { r = await generateLean(prompt, MODEL); if (r.parseError && a < 2) r = null; } catch (e) { await new Promise((res) => setTimeout(res, 4000 * (a + 1))); } }
        if (!r) { failed++; continue; }
        const s: any = scorePlace(row as never);
        const cost = (r.tokensIn * 2 + r.tokensOut * 12) / 1e6; spent += cost; completed++;
        results.push({ family: famOf(j.k), k: j.k, id: j.id, rank: 'batch', name: row.name, model: MODEL, tokensIn: r.tokensIn, tokensOut: r.tokensOut, cost, parseError: r.parseError, gemini: r.json, curve: (s.scores ?? s.monthly ?? {})[j.k], base: (row.baseScores as Record<string, number>)[j.k] ?? null });
        if (completed % 10 === 0) { saveEvery(); console.log(`${completed} done, ${failed} failed, $${spent.toFixed(2)}, ${queue.length} left`); }
      } finally { inflight--; }
    }
  };
  await Promise.all(Array.from({ length: conc }, worker));
  saveEvery();
  console.log(`finished: ${completed} written this run, ${failed} failed, ${queue.length} cells left, total spent $${spent.toFixed(2)}${stop ? ' (stopped at the budget cap)' : ''}`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
