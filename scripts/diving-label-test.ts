// TEST of the "Gemini writes + labels, a table scores" design for snorkeling & diving (10 Oct 2026). Writes nothing to the database.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/diving-label-test.ts --names="Bahamas,Iceland" --out=/path/to/out.json
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
  }
}
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);

async function main() {
  loadEnv();
  const names = (arg('names') ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const out = arg('out') ?? join(__dirname, '..', 'diving-label-test.json');
  if (names.length === 0) throw new Error('Pass --names="Place One,Place Two"');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { generateLabelled, MODEL } = await import('../src/lib/gemini/client');
  const { computeCost } = await import('../src/lib/gemini/cost');
  const all = await db.select().from(places);
  const facts = JSON.parse(readFileSync(join(__dirname, '..', 'docs', 'diving-facts.json'), 'utf8')) as Record<string, { forPlaceName: string; scope: string; facts: string[]; avoid: string[]; season: string }>;
  const template = readFileSync(join(__dirname, '..', 'prompts', '_drafts', 'diving-labels-v1-draft.md'), 'utf8');
  const voice = readFileSync(join(__dirname, '..', 'prompts', '_shared', 'voice-rules.md'), 'utf8');
  const results: Record<string, unknown> = {};
  let total = 0;
  console.log(`Thinking level: low (capped). Rough cost: ${names.length} places x about $0.02-0.03.`);
  for (const p of all.filter((x) => names.includes(x.name.toLowerCase()))) {
    const sheet = facts[p.id];
    if (sheet && sheet.forPlaceName !== p.name) { console.error(`SKIPPED ${p.name}: its fact sheet is for "${sheet.forPlaceName}"`); continue; }
    const context = { placeId: p.id, placeName: p.name, region: p.region, about: p.about ?? null, interestKey: 'diving', interestLabel: 'diving', ...(sheet ? { verifiedFacts: { scope: sheet.scope, facts: sheet.facts, avoid: sheet.avoid, season: sheet.season } } : {}) };
    const prompt = template.replace('{{VOICE_RULES}}', voice).replace('{{CONTEXT_JSON}}', JSON.stringify(context, null, 2));
    const r = await generateLabelled(prompt);
    const { costUsd } = computeCost(r.model, r.tokensIn, r.tokensOut);
    total += costUsd;
    console.log(`${p.name}: in=${r.tokensIn} out=${r.tokensOut} cost=$${costUsd.toFixed(4)} (model ${MODEL})`);
    results[p.id] = { name: p.name, json: r.json, cost: costUsd };
  }
  writeFileSync(out, JSON.stringify(results, null, 1));
  console.log(`Total $${total.toFixed(4)}. Saved ${out}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
