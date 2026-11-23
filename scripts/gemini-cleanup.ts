// 1 Nov 2026: wording cleanup pass on freshly authored family texts (Food batch). Sends each flagged cell's text to Gemini Flash with the specific wording rules it broke and asks for the same text back
// with ONLY those wording problems fixed. Nothing is written to the app: the output is a new results file, checked afterwards (same blurbs and months, no new named things, lengths, rules gone).
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/gemini-cleanup.ts --in=results.json --out=cleaned.json --budget=1.5
import { readFileSync, writeFileSync, existsSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
(async () => {
  const { TEXT_RULES } = await import('../src/lib/authoring/rules'); // single source for the rules: src/lib/authoring/rules.ts
  const RULES = TEXT_RULES.filter((r) => r.kind === 'fix').map((r) => ({ key: r.id, rx: new RegExp(r.source, 'i'), ask: r.ask! }));
  const input = JSON.parse(readFileSync(arg('in')!, 'utf8')) as any[]; const out = arg('out')!; const budget = Number(arg('budget') ?? '1.5');
  const { getGeminiClient, thinkingConfigFor } = await import('../src/lib/gemini/client'); const ai = getGeminiClient();
  const results: any[] = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : []; let spent = results.reduce((a, r) => a + r.cost, 0);
  const todo = input.filter((r) => r.gemini?.applicable !== false).map((r) => { const t = [r.gemini.overview, ...r.gemini.blurbs.map((b: any) => b.text)].join(' '); return { r, rules: RULES.filter((x) => x.rx.test(t)) }; }).filter((x) => x.rules.length && !results.some((y) => y.k === x.r.k && y.id === x.r.id));
  console.log(todo.length, 'cells to clean');
  let n = 0;
  for (const { r, rules } of todo) {
    if (spent >= budget) { console.log('budget reached'); break; }
    const payload = { overview: r.gemini.overview, blurbs: r.gemini.blurbs.map((b: any) => b.text) };
    const prompt = `You are copy-editing short travel texts. Fix ONLY the wording problems listed below and change nothing else: keep every fact, name, number and the order of sentences; do not add new places, dishes or claims; keep each blurb at 300 characters or fewer and the overview at 450 or fewer; use plain American English.\n\nProblems to fix:\n${rules.map((x, i) => `${i + 1}. ${x.ask}`).join('\n')}\n\nReturn JSON only, in exactly this shape: {"overview": string, "blurbs": [string, ...]} with the same number of blurbs in the same order.\n\nText:\n${JSON.stringify(payload)}`;
    const resp = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt, config: { temperature: 0, maxOutputTokens: 3000, thinkingConfig: thinkingConfigFor('minimal'), responseMimeType: 'application/json' } });
    const tin = resp.usageMetadata?.promptTokenCount ?? 0; const tout = (resp.usageMetadata?.candidatesTokenCount ?? 0) + (resp.usageMetadata?.thoughtsTokenCount ?? 0);
    const cost = (tin * 0.5 + tout * 3) / 1e6; spent += cost;
    let json: any = null; try { json = JSON.parse(resp.text ?? ''); } catch { /* leave null */ }
    results.push({ k: r.k, id: r.id, rules: rules.map((x) => x.key), cleaned: json, cost });
    writeFileSync(out, JSON.stringify(results)); n++;
    if (n % 25 === 0) console.log(n, 'done', spent.toFixed(3));
    await new Promise((res) => setTimeout(res, 300));
  }
  console.log('done', results.length, 'cells', '$' + spent.toFixed(3)); process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
