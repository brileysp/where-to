// Audit pass (read-only): asks a cheap Flash call to review the CURRENT live content of one interest per
// place for factual errors, wrong scope, missing key facts and score-shape problems. Writes a JSON file of
// findings only; never touches the database or places. Input is a JSON dump of place content.
//
// Usage: npx tsx scripts/gemini-audit.ts --interest=safari --in=/tmp/fix/sw_in.json --out=/tmp/fix/audit_safari.json
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { GoogleGenAI } from '@google/genai';
import { thinkingConfigFor } from '../src/lib/gemini/client';
import { computeCost } from '../src/lib/gemini/cost';
import { parseCliArgs, getString } from '../src/lib/gemini/cli';

const env: Record<string, string> = {};
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}
const MODEL = 'gemini-3-flash-preview';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEFS: Record<string, string> = {
  safari: 'SAFARI means traditional game viewing of large wildlife from a vehicle, on foot with rangers, or by boat/canoe inside a park or reserve (Big Five parks, waterhole viewing, migrations, tiger/rhino/elephant parks, river safaris). Gorilla, lemur, gelada or other primate TREKKING is not safari unless the place also has real game-drive safaris, which should then be what the text covers.',
  birding: 'BIRDING means travelling to see wild birds (species counts, endemics, famous target birds, migration or colony spectacles). Birds only. Judge: are the named species really found at the named sites in the named months; are endemic/rarity/count claims true; are species names the standard eBird/Clements English names; is access (site, boat, permit, guide) described honestly; and do the 12 scores follow the real seasons for this destination (breeding, migration, wintering, wet/dry, closures).',
  whaleWatching: 'WHALE WATCHING means boat or shore viewing of whales (and where the local trade is sold as whale-and-dolphin watching, dolphins). Judge whether the place genuinely offers it, from where exactly (the real port/bay, and how far from the destination named), in which months, and which species.',
};

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const interest = getString(args, 'interest')!;
  const inPath = getString(args, 'in')!;
  const outPath = getString(args, 'out')!;
  const data: any[] = JSON.parse(readFileSync(inPath, 'utf8')).filter((p: any) => p[interest] && p[interest].overview);
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const results: Record<string, any> = {};
  let total = 0, done = 0;
  const work = async (p: any) => {
    const c = p[interest];
    const lines = (c.months as string[]).map((t, i) => `${MONTHS[i]} (score ${c.scores ? c.scores[i] : '?'}): ${t}`).join('\n');
    const prompt = `You are a fact-checking travel editor auditing existing content. ${DEFS[interest]}

Destination: ${p.name} (${p.region}).
Current overview: ${c.overview}
Current monthly text and 0-10 interest score:
${lines}

Audit it and return ONLY JSON with these keys:
- "scope_ok": true/false (does the content describe real ${interest} at this destination, at the right place?)
- "scope_notes": one or two sentences (what is mis-scoped, or "ok")
- "errors": array of {"claim": exact quote, "problem": what is wrong, "confidence": "high"|"medium"|"low"}. Only real factual errors or doubtful claims; empty array if none.
- "key_facts": array of up to 6 {"fact": a specific, checkable fact a traveler needs (species, site, season window, access and distance from the destination, closure, typical odds), "months": which months, "confidence": "high"|"medium"|"low"} that the content should state.
- "missing": array of short strings (important sites, species, seasons or access details the content omits).
- "score_shape": one or two sentences: which months should truly be peak and which low, and whether the current 12 scores (flat, coarse, wrong months) fit.
- "should_be_na": true if the destination does not genuinely offer ${interest}, else false, with "na_reason" (string, may be empty).`;
    try {
      const res = await ai.models.generateContent({ model: MODEL, contents: prompt, config: { temperature: 0.2, responseMimeType: 'application/json', thinkingConfig: thinkingConfigFor() } });
      const text = (res.text ?? '').trim();
      const tin = res.usageMetadata?.promptTokenCount ?? 0;
      const tout = (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0);
      const cost = computeCost(MODEL, tin, tout).costUsd; total += cost;
      let parsed: any = null; try { parsed = JSON.parse(text); } catch { parsed = { parse_error: text.slice(0, 300) }; }
      results[p.id] = { name: p.name, cost, ...parsed };
    } catch (e: any) { results[p.id] = { name: p.name, error: String(e.message ?? e) }; }
    done++; if (done % 10 === 0) console.log(`${done}/${data.length} total so far $${total.toFixed(3)}`);
  };
  const queue = [...data]; const workers = Array.from({ length: 6 }, async () => { while (queue.length) await work(queue.shift()); });
  await Promise.all(workers);
  writeFileSync(outPath, JSON.stringify(results, null, 1));
  console.log(`DONE ${data.length} places, audit cost $${total.toFixed(4)}`);
  process.exit(0);
}
main();
