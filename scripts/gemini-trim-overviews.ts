// Optional "trim pass" (test, 2026-10-04): for staged birding generations whose overview is over its
// length ceiling, ask a cheap Flash call to shorten it without dropping species. NEVER writes to the
// database or to places; it only writes a JSON file of proposals for the review page.
//
// Usage: npx tsx scripts/gemini-trim-overviews.ts --batch-ids=<id>,<id> --out=/tmp/fix/trims.json
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { GoogleGenAI } from '@google/genai';
import { thinkingConfigFor } from '../src/lib/gemini/client';
import { contentGenerations } from '../src/lib/db/schema';
import { computeCost } from '../src/lib/gemini/cost';
import { parseCliArgs, getString } from '../src/lib/gemini/cli';

const env: Record<string, string> = {};
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
}
const MODEL = 'gemini-3-flash-preview';
const cap = (p: number) => (p < 4 ? 280 : p < 6 ? 380 : p < 8.5 ? 450 : 550);

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const batchIds = (getString(args, 'batch-ids') ?? '').split(',').filter(Boolean);
  const outPath = getString(args, 'out') ?? '/tmp/fix/trims.json';
  const db = drizzle(postgres(env.DATABASE_URL, { prepare: false }));
  const rows = await db.select().from(contentGenerations).where(inArray(contentGenerations.batchId, batchIds));
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const out: Record<string, { original: string; trimmed: string; limit: number; cost: number }> = {};
  let total = 0;
  for (const r of rows) {
    const p = r.parsedOutput as { overview: string; monthly: Array<{ score: number }> } | null;
    if (!p) continue;
    const limit = cap(Math.max(...p.monthly.map((m) => m.score)));
    if (p.overview.length <= limit) continue;
    const prompt = `Shorten this travel birding blurb to at most ${limit - 20} characters. Keep every bird species name, every likelihood word (reliably, commonly, frequently, occasionally, elusive), and every place name. Cut filler, repeated qualifiers and secondary detail. Do not add any new fact. Return only the shortened text.\n\n${p.overview}`;
    const res = await ai.models.generateContent({ model: MODEL, contents: prompt, config: { temperature: 0.2, thinkingConfig: thinkingConfigFor('minimal') } });
    const text = (res.text ?? '').trim();
    const tin = res.usageMetadata?.promptTokenCount ?? 0;
    const tout = (res.usageMetadata?.candidatesTokenCount ?? 0) + (res.usageMetadata?.thoughtsTokenCount ?? 0);
    const cost = computeCost(MODEL, tin, tout).costUsd;
    total += cost;
    out[r.placeId] = { original: p.overview, trimmed: text, limit, cost };
    console.log(`${r.placeId}: ${p.overview.length} -> ${text.length} (limit ${limit}) $${cost.toFixed(4)}`);
  }
  writeFileSync(outPath, JSON.stringify(out, null, 1));
  console.log(`Total trim cost $${total.toFixed(4)} for ${Object.keys(out).length} overviews. Proposals only; nothing applied.`);
  process.exit(0);
}
main();
