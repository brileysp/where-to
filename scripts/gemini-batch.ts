// 1 Nov 2026: bulk authoring through Gemini's batch interface (half price, separate limits from the 250-requests-a-day cap, results within about a day).
// Same prompt as scripts/gemini-family-batch.ts (family directive + scores section), same lean config (thinking capped), but the requests go up as one job and are collected later.
// Nothing is written to the database or the app: collected results go to a JSON file in the same shape the review pages and checks already read.
//
//   submit   build the queue of cells with no text, send up to --limit as one job, save the job name to --state
//   status   print the job's state and counts
//   collect  when the job has succeeded, read the responses into --out (cells that failed are listed and can be resubmitted)
//   cancel   cancel the job
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/gemini-batch.ts submit --interests=a,b --state=job.json [--limit=600] [--skip=a.json,b.json] [--model=gemini-3.1-pro-preview] [--dry]
//        PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/gemini-batch.ts status --state=job.json
//        PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/gemini-batch.ts collect --state=job.json --out=results.json
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const cmd = process.argv[2];
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const KIND: Record<string, string> = { country: 'a whole country', region: 'a region', state_province: 'a state or province', island: 'an island or island group', city: 'a city', neighborhood: 'a neighborhood', national_park: 'a national park', wilderness_area: 'a wilderness area', coastal_area: 'a coastal area', day_trip: 'a day trip' };
const strip = (t: string) => t.replace(/<!--[\s\S]*?-->/g, '').trim();
const PRICE: Record<string, { i: number; o: number }> = { 'gemini-3.1-pro-preview': { i: 2, o: 12 }, 'gemini-3-flash-preview': { i: 0.5, o: 3 } };
(async () => {
  const state = arg('state');
  if (!['submit', 'status', 'collect', 'cancel'].includes(cmd ?? '') || !state) { console.log('Usage: submit|status|collect|cancel --state=job.json (see the header of this file)'); process.exit(1); }
  const { getGeminiClient, leanGenerateConfig, MODEL } = await import('../src/lib/gemini/client');
  const ai = getGeminiClient();

  if (cmd === 'submit') {
    const interests = (arg('interests') ?? '').split(',').filter(Boolean);
    const limit = Number(arg('limit') ?? '600'); const model = arg('model') ?? MODEL; const dry = process.argv.includes('--dry');
    const root = join(__dirname, '..');
    const scopes = JSON.parse(readFileSync(join(__dirname, 'data', 'family-scopes.json'), 'utf8')) as Record<string, { interests: Record<string, { label: string; about: string; notCount: string; scope: string }> }>;
    const famOf = (k: string) => Object.keys(scopes).find((f) => scopes[f].interests[k]);
    for (const k of interests) if (!famOf(k)) throw new Error(`No family scope for ${k}`);
    const template = strip(readFileSync(join(root, 'prompts', 'family-v1.md'), 'utf8'));
    const core = strip(readFileSync(join(root, 'prompts', '_shared', 'authoring-core.md'), 'utf8'));
    const scoreRules = strip(readFileSync(join(root, 'prompts', '_shared', 'authoring-scores.md'), 'utf8'));
    const { db } = await import('../src/lib/db/client');
    const { places } = await import('../src/lib/db/schema');
    const rows = await db.select().from(places);
    const done = new Set<string>();
    for (const f of (arg('skip') ?? '').split(',').filter(Boolean)) if (existsSync(f)) for (const r of JSON.parse(readFileSync(f, 'utf8'))) done.add(`${r.k}|${r.id}`);
    const cells: Array<{ k: string; id: string }> = [];
    for (const k of interests) for (const r of rows) if (!r.naSliders.includes(k) && !((r.sliderOverview as Record<string, string> | null)?.[k]) && !done.has(`${k}|${r.id}`)) cells.push({ k, id: r.id });
    const chosen = cells.slice(0, limit);
    const requests = chosen.map(({ k, id }) => {
      const row = rows.find((r) => r.id === id)!; const fam = scopes[famOf(k)!];
      const table = ['| Interest | It is about | Does not count toward it |', '|---|---|---|', ...Object.values(fam.interests).map((i) => `| ${i.label} | ${i.about} | ${i.notCount} |`)].join('\n');
      const place = `${row.name} (${KIND[row.placeType ?? ''] ?? 'a place'}; ${row.region}${row.countryCode ? `, ${row.countryCode}` : ''})`;
      const prompt = template.replace('{{PLACE}}', place).replace(/\{\{LABEL\}\}/g, fam.interests[k].label).replace('{{SCOPE}}', fam.interests[k].scope).replace('{{FAMILY_TABLE}}', table).replace('{{CORE}}', core) + '\n\n' + scoreRules;
      return { model, contents: [{ role: 'user', parts: [{ text: prompt }] }], metadata: { k, id }, config: leanGenerateConfig(undefined, true) };
    });
    const bytes = Buffer.byteLength(JSON.stringify(requests));
    console.log(`${cells.length} cells lack text; ${requests.length} in this job (${(bytes / 1e6).toFixed(1)} MB); model ${model}`);
    if (bytes > 18e6) throw new Error('Job is over about 18 MB (inline limit is 20 MB): lower --limit');
    if (dry) process.exit(0);
    const job = await ai.batches.create({ model, src: requests as never, config: { displayName: `family-authoring-${new Date().toISOString().slice(0, 16)}` } });
    writeFileSync(state, JSON.stringify({ name: job.name, model, createdAt: new Date().toISOString(), cells: chosen, state: job.state }, null, 1));
    console.log('submitted', job.name, job.state);
    process.exit(0);
  }

  const st = JSON.parse(readFileSync(state, 'utf8')) as { name: string; model: string; cells: Array<{ k: string; id: string }> };
  if (cmd === 'cancel') { await ai.batches.cancel({ name: st.name }); console.log('cancel requested for', st.name); process.exit(0); }
  const job = await ai.batches.get({ name: st.name });
  console.log(`${st.name}: ${job.state}; successful ${job.completionStats?.successfulCount ?? '?'}, failed ${job.completionStats?.failedCount ?? '?'}, incomplete ${job.completionStats?.incompleteCount ?? '?'}${job.error ? ' ERROR ' + JSON.stringify(job.error) : ''}`);
  if (cmd === 'status') process.exit(0);

  // collect
  const out = arg('out'); if (!out) throw new Error('collect needs --out=results.json');
  if (String(job.state) !== 'JOB_STATE_SUCCEEDED') { console.log('The job has not succeeded yet; try again later.'); process.exit(1); }
  const responses = job.dest?.inlinedResponses ?? [];
  console.log(`${responses.length} responses for ${st.cells.length} cells`);
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { scorePlace } = await import('../src/lib/db/queries/places');
  const rows = await db.select().from(places);
  const price = PRICE[st.model] ?? PRICE['gemini-3.1-pro-preview'];
  const results: any[] = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : [];
  const have = new Set(results.map((r) => `${r.k}|${r.id}`));
  const failed: Array<{ k: string; id: string; why: string }> = [];
  responses.forEach((resp, idx) => {
    const cell = (resp.metadata as { k?: string; id?: string } | undefined)?.k ? { k: resp.metadata!.k, id: resp.metadata!.id } : st.cells[idx];
    if (have.has(`${cell.k}|${cell.id}`)) return;
    const r: any = resp.response;
    const parts: any[] = r?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
    let json: any = null, parseError: string | null = null;
    if (!text) parseError = (resp as any).error ? JSON.stringify((resp as any).error) : 'empty response'; else { try { json = JSON.parse(text); } catch (e) { parseError = (e as Error).message; } }
    if (!json) { failed.push({ ...cell, why: parseError ?? 'no json' }); return; }
    const um = r?.usageMetadata ?? {}; const tokensIn = um.promptTokenCount ?? 0; const tokensOut = (um.candidatesTokenCount ?? 0) + (um.thoughtsTokenCount ?? 0);
    const cost = ((tokensIn * price.i + tokensOut * price.o) / 1e6) * 0.5; // batch mode is half price
    const row = rows.find((x) => x.id === cell.id)!; const sc: any = scorePlace(row as never);
    results.push({ family: 'batch', k: cell.k, id: cell.id, rank: 'batch', name: row.name, model: st.model, tokensIn, tokensOut, cost, parseError: null, gemini: json, curve: (sc.scores ?? sc.monthly ?? {})[cell.k], base: (row.baseScores as Record<string, number>)[cell.k] ?? null });
  });
  writeFileSync(out, JSON.stringify(results));
  writeFileSync(state.replace(/\.json$/, '') + '.failed.json', JSON.stringify(failed, null, 1));
  console.log(`collected ${results.length} results into ${out}; ${failed.length} failed (listed in ${state.replace(/\.json$/, '')}.failed.json); batch cost so far $${results.reduce((a, r) => a + r.cost, 0).toFixed(3)}`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack ?? e.message); process.exit(1); });
