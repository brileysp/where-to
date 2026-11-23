// 1 Nov 2026: fact-checks saved or drafted family texts with Google Search (owner: Museums & Art and Architecture "need to be fact checked").
// For each cell, Gemini is given the place, the interest and the text and asked to check every named thing and factual claim against what it finds on the web, returning a verdict and a
// source page for each. Nothing is written to the app: the verdicts go to a JSON file for review; wrong or unclear items are then corrected by hand.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/gemini-verify.ts --in=results.json --out=verdicts.json [--only=k|id,k|id] [--interests=a,b] [--limit=N] [--budget=3] [--concurrency=3]
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
(async () => {
  const inp = arg('in'), out = arg('out'); if (!inp || !out) { console.log('Usage: --in=results.json --out=verdicts.json [--only=k|id,...] [--interests=a,b] [--limit=N] [--budget=3] [--concurrency=3]'); process.exit(1); }
  const only = new Set((arg('only') ?? '').split(',').filter(Boolean)); const ints = new Set((arg('interests') ?? '').split(',').filter(Boolean));
  const budget = Number(arg('budget') ?? '3'); const conc = Number(arg('concurrency') ?? '3'); const limit = Number(arg('limit') ?? '100000');
  const scopes = JSON.parse(readFileSync(join(__dirname, 'data', 'family-scopes.json'), 'utf8')) as Record<string, { interests: Record<string, { label: string }> }>;
  const label = (k: string) => Object.values(scopes).map((f) => f.interests[k]?.label).find(Boolean) ?? k;
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { generateVerified } = await import('../src/lib/gemini/client');
  const rows = await db.select().from(places);
  const src: any[] = JSON.parse(readFileSync(inp, 'utf8'));
  const res: any[] = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : [];
  const have = new Set(res.map((r) => `${r.k}|${r.id}`));
  const queue = src.filter((r) => r.gemini?.applicable && (!only.size || only.has(`${r.k}|${r.id}`)) && (!ints.size || ints.has(r.k)) && !have.has(`${r.k}|${r.id}`)).slice(0, limit);
  let spent = res.reduce((a, r) => a + r.cost, 0), inflight = 0, stop = false, done = 0, failed = 0;
  console.log(`${queue.length} texts to check; cap $${budget}`);
  const worker = async () => {
    while (!stop) {
      if (spent + inflight * 0.06 >= budget) { stop = true; break; }
      const r = queue.shift(); if (!r) break; inflight++;
      try {
        const row = rows.find((x) => x.id === r.id)!; const g = r.gemini;
        const text = [`Overview: ${g.overview}`, ...g.blurbs.map((b: any) => `${b.months.map((m: number) => MN[m - 1]).join(', ')}: ${b.text}`)].join('\n');
        const prompt = `You are a careful fact-checker for a travel app. The place is "${row.name}" (${row.region}). The interest is ${label(r.k)}. The text below was written from a model's memory some time ago and may be wrong or out of date: attractions close, move, rename or change their hours. Search the web for the current situation of every named thing and claim in it and report what the pages say. Do not answer from memory.

For every specific named thing (museum, gallery, building, district, monument, route, festival) and every checkable claim (what a place is or holds, a number, an opening season or closure, "oldest", "only", "largest"), decide:
- "verified": you found a reliable page that confirms it is real, is in or near this place, and is what the text says it is.
- "wrong": it does not exist under that name, is somewhere else, or the claim contradicts what you found. Give the correction.
- "unclear": you could not find enough to confirm or deny it.
Be strict: if you cannot find a page for a named thing, say "unclear", not "verified". Opening hours and seasons change; check they match what official or tourism pages say.

First write short notes on what the pages you found say for each item. Then finish with one JSON object on its own, starting with a line that contains only the word JSON: {"overall":"clean"|"fix"|"unsure","items":[{"claim":"short quote","status":"verified"|"wrong"|"unclear","correction":"what is true, or empty","source":"url or empty"}]}. List every named thing at least once.

TEXT:
${text}`;
        let o: Awaited<ReturnType<typeof generateVerified>> | null = null; let lastErr = '';
        for (let a = 0; a < 3 && !o; a++) { try { const t = await generateVerified(prompt); if (t.queries.length === 0 && a < 2) continue; o = t; } catch (e) { lastErr = String((e as Error).message).slice(0, 160); await new Promise((s) => setTimeout(s, 4000 * (a + 1))); } }
        if (!o) { failed++; console.log('FAILED', r.k, r.id, lastErr); continue; }
        let json: any = null; const idx = o.text.lastIndexOf('{"overall"'); const m = idx >= 0 ? o.text.slice(idx).match(/\{[\s\S]*\}/) : o.text.match(/\{[\s\S]*\}/); if (m) { try { json = JSON.parse(m[0]); } catch { json = null; } }
        const cost = (o.tokensIn * 2 + o.tokensOut * 12) / 1e6 + o.queries.length * 0.014; // search queries are billed separately (about $14 per 1,000 for this model; check the invoice)
        spent += cost; done++;
        res.push({ k: r.k, id: r.id, name: r.name, verdict: json, parseOk: !!json, grounded: o.queries.length > 0, sources: o.sources, queries: o.queries, tokensIn: o.tokensIn, tokensOut: o.tokensOut, cost });
        if (done % 10 === 0) { writeFileSync(out, JSON.stringify(res)); console.log(`${done} done, ${failed} failed, ~$${spent.toFixed(2)}, ${queue.length} left`); }
      } finally { inflight--; }
    }
  };
  await Promise.all(Array.from({ length: conc }, worker));
  writeFileSync(out, JSON.stringify(res));
  console.log(`finished: ${done} checked, ${failed} failed, ${queue.length} left, ~$${spent.toFixed(2)}`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
