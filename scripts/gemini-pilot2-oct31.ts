// 31 Oct 2026: second authoring pilot. The same 8 Diving places, written with the existing Diving directive (prompts/diving/v7.md, the one used for the approved text)
// and the same prompt assembly as scripts/gemini-author-batch.ts, but WITHOUT the hand-built fact sheet. Compare with the short-input version (pilot 1) and with the original
// generations (directive plus fact sheet) already in content_generations. Nothing is written to the database. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/gemini-pilot2-oct31.ts --out=file.json [--budget=0.8]
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
(async () => {
  const out = arg('out'); if (!out) { console.log('Usage: --out=file.json [--budget=0.8]'); process.exit(1); }
  const budget = Number(arg('budget') ?? '0.8');
  const ids = (JSON.parse(readFileSync(join(__dirname, 'data', 'gemini-pilot-places-oct31.json'), 'utf8')).diving as Array<{ id: string }>).map((x) => x.id);
  const root = join(__dirname, '..');
  const strip = (t: string) => t.replace(/<!--[\s\S]*?-->/g, '').trim();
  const template = readFileSync(join(root, 'prompts', 'diving', 'v7.md'), 'utf8');
  const voice = readFileSync(join(root, 'prompts', '_shared', 'voice-rules.md'), 'utf8');
  const voiceOpenTop = voice.replace(/- \*\*A literal maximum score[\s\S]*?(?=\n- \*\*|\s*$)/, '').replace(/\n{3,}/g, '\n\n');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { generate } = await import('../src/lib/gemini/client');
  const rows = await db.select().from(places);
  const results: any[] = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : [];
  let spent = results.reduce((a, r) => a + r.cost, 0);
  for (const id of ids) {
    if (results.some((r) => r.id === id)) continue;
    if (spent >= budget) { console.log(`Budget cap $${budget} reached; stopping.`); break; }
    const p = rows.find((r) => r.id === id)!;
    const context = { placeId: p.id, placeName: p.name, region: p.region, about: p.about ?? null, interestKey: 'diving', interestLabel: 'diving' };
    const prompt = template.replace(/<!--[\s\S]*?-->/g, '').trimStart().replace('{{VOICE_RULES}}', strip(voice)).replace('{{VOICE_RULES_OPEN_TOP}}', strip(voiceOpenTop)).replace('{{CONTEXT_JSON}}', JSON.stringify(context, null, 2));
    const r = await generate(prompt, 'flat-v2-fit');
    const cost = (r.tokensIn * 2 + r.tokensOut * 12) / 1e6;
    spent += cost;
    results.push({ id, name: p.name, tokensIn: r.tokensIn, tokensOut: r.tokensOut, cost, parseError: r.parseError, output: r.parsed });
    writeFileSync(out, JSON.stringify(results, null, 1));
    console.log(`${p.name.slice(0, 28).padEnd(28)} in ${r.tokensIn} out ${r.tokensOut} $${cost.toFixed(4)} total $${spent.toFixed(3)}`);
    await new Promise((res) => setTimeout(res, 1200));
  }
  console.log(`done: ${results.length} results, $${spent.toFixed(3)}`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
