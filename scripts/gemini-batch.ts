// 1 Nov 2026: bulk authoring through Gemini's batch interface (half price, separate limits from the 250-requests-a-day cap, results within about a day).
// Same prompt as scripts/gemini-family-batch.ts (family directive + scores section), same lean config (thinking capped), but the requests go up as one job and are collected later.
// Nothing is written to the database or the app: collected results go to a JSON file in the same shape the review pages and checks already read.
//
//   submit   build the queue of cells with no text, send up to --limit as one job, save the job name to --state
//   status   print the job's state and counts
//   collect  when the job has succeeded, read the responses into --out (cells that failed are listed and can be resubmitted)
//   cancel   cancel the job
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/gemini-batch.ts submit --interests=a,b --state=job.json [--limit=600] [--keep-applicable] [--only=k|id,...] [--facts=scripts/data/pilot-facts-nov9.json] [--skip=a.json,b.json] [--model=gemini-3.1-pro-preview] [--dry]
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
  const { installLabelFilter } = await import('../src/lib/places/console-labels'); await installLabelFilter(); // standard D03: a report never prints a place key
  await (await import('../src/lib/places/renamed-sync')).syncRenamedPlacesFile(); // the old-name check reads the label history
  const state = arg('state');
  if (!['submit', 'status', 'collect', 'cancel'].includes(cmd ?? '') || !state) { console.log('Usage: submit|status|collect|cancel --state=job.json (see the header of this file)'); process.exit(1); }
  const { getGeminiClient, leanGenerateConfig, MODEL } = await import('../src/lib/gemini/client');
  const ai = getGeminiClient();

  if (cmd === 'submit') {
    const interests = (arg('interests') ?? '').split(',').filter(Boolean);
    const keepApplicable = process.argv.includes('--keep-applicable'); const { resolvePlaceEntries } = await import('../src/lib/places/script-args'); const only = await resolvePlaceEntries((arg('only') ?? '').split(',').filter(Boolean)); /* 18 Nov 2026: slugs and old ids work, as well as keys */ // 3 Nov 2026: --keep-applicable tells Gemini the owner already kept the cell applicable; --only=k|id,k|id limits the queue
    const factsFile = arg('facts'); const placeFacts: Record<string, string> = factsFile ? JSON.parse(readFileSync(factsFile, 'utf8')) : {}; // 9 Nov 2026: --facts adds a measured / recorded facts block per cell (pilot batch of Scenic, Stargazing, Sunbathing, Spa)
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
    for (const k of interests) for (const r of rows) if (!r.naSliders.includes(k) && !((r.sliderOverview as Record<string, string> | null)?.[k]) && !done.has(`${k}|${r.id}`) && (!only.length || only.includes(`${k}|${r.id}`))) cells.push({ k, id: r.id });
    // 20 Nov 2026 (standard D05): a renamed or widened place is not sent until the owner has confirmed its scope; the old names and narrower scopes keep coming back through facts written for them.
    const { renamedWithoutConfirmedScope } = await import('../src/lib/places/gemini-scope-guard'); const { placeIdentity } = await import('../src/lib/db/schema');
    const scopeStatus = Object.fromEntries((await db.select({ key: placeIdentity.key, s: placeIdentity.scopeStatus }).from(placeIdentity)).map((r) => [r.key, r.s]));
    const renamedDoc = (JSON.parse(readFileSync(join(root, 'docs', 'renamed-places.json'), 'utf8')) as { ids: Record<string, string> }).ids;
    const blocked = process.argv.includes('--allow-unscoped-renamed') ? [] : renamedWithoutConfirmedScope(cells, renamedDoc, scopeStatus);
    for (const b of blocked) console.error(`-- ${b.note} -- SKIPPED: renamed or widened place whose scope the owner has not confirmed. Confirm it on the Names & scope screen and rebuild its facts for the current name, or pass --allow-unscoped-renamed.`);
    const blockedSet = new Set(blocked.map((b) => `${b.k}|${b.id}`)); for (let i = cells.length - 1; i >= 0; i--) if (blockedSet.has(`${cells[i].k}|${cells[i].id}`)) cells.splice(i, 1);
    const chosen = cells.slice(0, limit);
    const requests = chosen.map(({ k, id }) => {
      const row = rows.find((r) => r.id === id)!; const fam = scopes[famOf(k)!];
      const table = ['| Interest | It is about | Does not count toward it |', '|---|---|---|', ...Object.values(fam.interests).map((i) => `| ${i.label} | ${i.about} | ${i.notCount} |`)].join('\n');
      const place = `${row.name} (${KIND[row.placeType ?? ''] ?? 'a place'}; ${row.region}${row.countryCode ? `, ${row.countryCode}` : ''})`;
      const prompt = template.replace('{{PLACE}}', place).replace(/\{\{LABEL\}\}/g, fam.interests[k].label).replace('{{SCOPE}}', fam.interests[k].scope).replace('{{FAMILY_TABLE}}', table).replace('{{CORE}}', core) + '\n\n' + scoreRules + (placeFacts[`${k}|${id}`] ? `\n\n## Facts about this place\nThese figures are measured or recorded for this place. Use them to decide the score and what to write, and trust them over your memory. Describe patterns in words (for example "no true night in June", "the wet season"); do not paste the figures or tables into the text.\n${placeFacts[`${k}|${id}`]}` : '') + (keepApplicable ? `\n\n## Owner decision for this place\nThe owner has already decided that ${fam.interests[k].label} stays applicable at this place, even though it looks thin. Set "applicable" to true and write the text for what a visitor can realistically find there (for example in the nearest town or gateway), honestly and modestly; do not invent anything. Give low scores when the real offering is small.` : '');
      if (arg('show') === `${k}|${id}`) console.log(prompt);
      return { model, contents: [{ role: 'user', parts: [{ text: prompt }] }], metadata: { k, id }, config: leanGenerateConfig(undefined, true) };
    });
    const bytes = Buffer.byteLength(JSON.stringify(requests));
    console.log(`${cells.length} cells lack text; ${requests.length} in this job (${(bytes / 1e6).toFixed(1)} MB); model ${model}`);
    { const pr = PRICE[model] ?? PRICE['gemini-3.1-pro-preview']; const inTok = requests.reduce((a, r) => a + Math.round(((r.contents[0].parts[0] as { text: string }).text.length) / 4), 0); // 13 Nov 2026: cost shown before anything is sent (output guess = the 1,590 tokens per cell, thinking included, measured on the batch of 13 Nov)
      console.log(`about ${Math.round(inTok / Math.max(requests.length, 1))} tokens in per request; ESTIMATED COST of this job: $${(((inTok * pr.i + requests.length * 1590 * pr.o) / 1e6) * 0.5).toFixed(3)} (batch price, thinking cap on)`); }
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
  // 13 Nov 2026, free checks at collect time (no extra Gemini calls): (1) the new texts' scores are balanced so every last digit .0-.9 is used about equally, together with the
  // scores already live (the live ones never move; Gemini's own numbers are kept as gemini_raw_scores); (2) the structure and old-pipeline rules are run so the cells that need
  // a split or a rewrite are listed straight away.
  {
    const { balanceResults } = await import('../src/lib/authoring/balance-results');
    const { scanStructure } = await import('../src/lib/authoring/rules'); const { oldRuleHits } = await import('../src/lib/authoring/old-rules');
    const fresh = results.filter((r) => !have.has(`${r.k}|${r.id}`) && r.gemini?.applicable && Array.isArray(r.gemini.monthly_scores) && r.gemini.monthly_scores.length === 12);
    for (const line of balanceResults(fresh, rows as any[])) console.log(line);
    const byRule = new Map<string, string[]>();
    for (const r of fresh) {
      const g = r.gemini; const row = rows.find((x) => x.id === r.id);
      const hits = [...scanStructure(g.blurbs.map((b: any) => ({ months: b.months, text: b.text })), g.monthly_scores), ...oldRuleHits(g, r.k, r.id, row?.countryCode).map((h) => h.id)];
      for (const h of hits) byRule.set(h, [...(byRule.get(h) ?? []), `${r.k}:${r.id}`]);
    }
    console.log(`${fresh.length} new cells checked. Structure and old-rule hits (cells listed; run scripts/scan-texts.ts for the wording rules):`);
    for (const [h, ids] of [...byRule].sort((a, b) => b[1].length - a[1].length)) console.log(`  ${h.padEnd(16)} ${String(ids.length).padStart(3)}  ${ids.slice(0, 8).join(', ')}${ids.length > 8 ? ', ...' : ''}`);
  }
  writeFileSync(out, JSON.stringify(results));
  writeFileSync(state.replace(/\.json$/, '') + '.failed.json', JSON.stringify(failed, null, 1));
  console.log(`collected ${results.length} results into ${out}; ${failed.length} failed (listed in ${state.replace(/\.json$/, '')}.failed.json); batch cost so far $${results.reduce((a, r) => a + r.cost, 0).toFixed(3)}`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack ?? e.message); process.exit(1); });
