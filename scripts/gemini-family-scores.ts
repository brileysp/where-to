// 1 Nov 2026: adds Gemini's own month scores to texts it has already written (owner: "Gemini should always do scores, so we can vet them against our scores").
// Sends the place, the interest description, the text Gemini wrote and the scoring rules (prompts/_shared/authoring-scores.md); gets twelve scores in tenths back.
// Nothing is written to the database or the app. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/gemini-family-scores.ts --in=batch.json --out=scores.json [--model=gemini-3-flash-preview] [--budget=1] [--concurrency=6]
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const KIND: Record<string, string> = { country: 'a whole country', region: 'a region', state_province: 'a state or province', island: 'an island or island group', city: 'a city', neighborhood: 'a neighborhood', national_park: 'a national park', wilderness_area: 'a wilderness area', coastal_area: 'a coastal area', day_trip: 'a day trip' };
const strip = (t: string) => t.replace(/<!--[\s\S]*?-->/g, '').trim();
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
(async () => {
  const inp = arg('in'), out = arg('out');
  if (!inp || !out) { console.log('Usage: --in=batch.json --out=scores.json [--model=...] [--budget=1] [--concurrency=6]'); process.exit(1); }
  const model = arg('model') ?? 'gemini-3-flash-preview'; const budget = Number(arg('budget') ?? '1'); const conc = Number(arg('concurrency') ?? '6');
  const price = model.includes('flash') ? { i: 0.5, o: 3 } : { i: 2, o: 12 };
  const root = join(__dirname, '..');
  const scopes = JSON.parse(readFileSync(join(__dirname, 'data', 'family-scopes.json'), 'utf8')) as Record<string, { interests: Record<string, { label: string; scope: string }> }>;
  const scoreRules = strip(readFileSync(join(root, 'prompts', '_shared', 'authoring-scores.md'), 'utf8'));
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { generateScoresOnly } = await import('../src/lib/gemini/client');
  const rows = await db.select().from(places);
  const src: any[] = JSON.parse(readFileSync(inp, 'utf8'));
  const res: any[] = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : [];
  const have = new Set(res.map((r) => `${r.k}|${r.id}`));
  const queue = src.filter((r) => r.gemini?.applicable && !have.has(`${r.k}|${r.id}`));
  let spent = res.reduce((a, r) => a + r.cost, 0), inflight = 0, stop = false, done = 0, failed = 0;
  console.log(`${queue.length} texts to score; model ${model}; cap $${budget}`);
  const worker = async () => {
    while (!stop) {
      if (spent + inflight * 0.01 >= budget) { stop = true; break; }
      const r = queue.shift(); if (!r) break; inflight++;
      try {
        const row = rows.find((x) => x.id === r.id)!; const fam = Object.keys(scopes).find((f) => scopes[f].interests[r.k])!; const it = scopes[fam].interests[r.k];
        const g = r.gemini;
        const text = [`Overview: ${g.overview}`, ...g.blurbs.map((b: any) => `${b.months.map((m: number) => MN[m - 1]).join(', ')} (${b.level}): ${b.text}`)].join('\n');
        const prompt = `You score a place for a travel app. The place is ${row.name} (${KIND[row.placeType ?? ''] ?? 'a place'}; ${row.region}). The interest is ${it.label}: ${it.scope}\n\nHere is the text written for this place and interest:\n\n${text}\n\n${scoreRules}\n\nReturn only monthly_scores (twelve numbers, January to December). Optionally put one short sentence in note if a score needs explaining.`;
        let o: Awaited<ReturnType<typeof generateScoresOnly>> | null = null; let lastErr = '';
        for (let a = 0; a < 3 && !o; a++) { try { o = await generateScoresOnly(prompt, model); if ((o.parseError || !o.json || o.json.monthly_scores?.length !== 12) && a < 2) o = null; } catch (err) { lastErr = String((err as Error).message).slice(0, 160); await new Promise((s) => setTimeout(s, 4000 * (a + 1))); } }
        if (!o || !o.json) { failed++; console.log('FAILED', r.k, r.id, lastErr || 'bad or short scores'); continue; }
        const cost = (o.tokensIn * price.i + o.tokensOut * price.o) / 1e6; spent += cost; done++;
        res.push({ k: r.k, id: r.id, model, scores: o.json.monthly_scores, note: o.json.note ?? '', cost, tokensIn: o.tokensIn, tokensOut: o.tokensOut });
        if (done % 20 === 0) { writeFileSync(out, JSON.stringify(res)); console.log(`${done} done, ${failed} failed, $${spent.toFixed(3)}, ${queue.length} left`); }
      } finally { inflight--; }
    }
  };
  await Promise.all(Array.from({ length: conc }, worker));
  writeFileSync(out, JSON.stringify(res));
  console.log(`finished: ${done} scored, ${failed} failed, ${queue.length} left, total $${spent.toFixed(3)}`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
