// 31 Oct 2026: the lean authoring pilot (artifact "Gemini Authoring Plan"). 8 places for each of Whale Watching, Diving, Museums & Art and Golf,
// plus the same 8 Museums & Art places on the Flash model. Nothing is written to the database or the app: results go to a JSON file for review.
// Gemini gets only the place, a short interest description and the voice rules (prompts/pilot/lean-v1.md); our scores and columns are read
// here only to be saved beside the answer for the checks. Thinking is capped by generateLean like every call; a budget cap stops the run.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/gemini-pilot-oct31.ts --out=file.json [--dry] [--budget=2.5]
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const SCOPE: Record<string, { label: string; scope: string }> = {
  whaleWatching: { label: 'Whale Watching', scope: 'Seeing wild whales, dolphins and porpoises as a reason to visit: from a boat, from shore or from the air. It covers which species a visitor can realistically see, where they watch from, and when the animals are there. Captive animals, aquariums and dolphin shows do not count. It applies wherever a visitor can reasonably expect to see wild cetaceans on a day trip from the place, even if the season is short or the odds are modest.' },
  diving: { label: 'Snorkeling & Diving', scope: 'Getting in the water to look: scuba diving and snorkeling on reefs, walls, wrecks, caves, kelp forests, blue holes, springs and lakes, and in-water encounters with animals people legally swim with (sharks, rays, turtles, sea lions, manatees). Captive animals, surfing, sailing, kayaking and beach swimming with nothing to see underwater do not count. It applies wherever something worth seeing underwater is within a day trip of the place; cold water alone does not rule it out.' },
  museumsArt: { label: 'Museums & Art', scope: 'Museums, galleries and art as a reason to visit: the major collections, the best-known museums, art districts, and notable temporary shows or fairs that recur. Historic sites and architecture are covered by other interests, so mention them only where they are also a museum. It applies wherever a visitor can spend meaningful time in museums or galleries, even a small number; it does not apply where there are none worth a visit.' },
  golf: { label: 'Golf', scope: 'Playing golf as a reason to visit: courses a visitor can book, whether famous or simply good, including links, resort and scenic courses, and the months in which they can be played. Watching tournaments, golf shops and driving ranges do not count. It applies wherever a visitor can play a proper course within a day trip of the place; it does not apply where no real course exists.' },
};
const PRICE: Record<string, { in: number; out: number }> = { 'gemini-3.1-pro-preview': { in: 2, out: 12 }, 'gemini-3-flash-preview': { in: 0.5, out: 3 } };
const KIND: Record<string, string> = { country: 'a whole country', region: 'a region', state_province: 'a state or province', island: 'an island or island group', city: 'a city', neighborhood: 'a neighborhood', national_park: 'a national park', wilderness_area: 'a wilderness area', coastal_area: 'a coastal area', day_trip: 'a day trip' };
(async () => {
  const dry = process.argv.includes('--dry');
  const out = arg('out');
  if (!out && !dry) { console.log('Usage: --out=file.json [--dry] [--budget=2.5]'); process.exit(1); }
  const budget = Number(arg('budget') ?? '2.5');
  const sel = JSON.parse(readFileSync(join(__dirname, 'data', 'gemini-pilot-places-oct31.json'), 'utf8')) as Record<string, Array<{ id: string; name: string }>>;
  const template = readFileSync(join(__dirname, '..', 'prompts', 'pilot', 'lean-v1.md'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim();
  const { db } = await import('../src/lib/db/client');
  const { places, placeInterestFacts } = await import('../src/lib/db/schema');
  const { scorePlace } = await import('../src/lib/db/queries/places');
  const { generateLean, MODEL } = await import('../src/lib/gemini/client');
  const rows = await db.select().from(places);
  const facts = await db.select().from(placeInterestFacts);
  const jobs: Array<{ k: string; id: string; model: string }> = [];
  for (const k of Object.keys(sel)) for (const p of sel[k]) jobs.push({ k, id: p.id, model: MODEL });
  for (const p of sel.museumsArt) jobs.push({ k: 'museumsArt', id: p.id, model: 'gemini-3-flash-preview' });
  const results: unknown[] = existsSync(out ?? '') ? JSON.parse(readFileSync(out!, 'utf8')) : [];
  const done = new Set((results as Array<{ k: string; id: string; model: string }>).map((r) => `${r.k}|${r.id}|${r.model}`));
  let spent = (results as Array<{ cost: number }>).reduce((a, r) => a + r.cost, 0);
  for (const j of jobs) {
    if (done.has(`${j.k}|${j.id}|${j.model}`)) continue;
    const row = rows.find((r) => r.id === j.id)!;
    const s: any = scorePlace(row as never);
    const monthly: number[] = (s.scores ?? s.monthly ?? {})[j.k];
    const place = `${row.name} (${KIND[row.placeType ?? ''] ?? 'a place'}; ${row.region}${row.countryCode ? `, ${row.countryCode}` : ''})`;
    const prompt = template.replace('{{PLACE}}', place).replace('{{LABEL}}', SCOPE[j.k].label).replace('{{SCOPE}}', SCOPE[j.k].scope);
    if (dry) { console.log(prompt); console.log('\n~ chars', prompt.length); process.exit(0); }
    if (spent >= budget) { console.log(`Budget cap $${budget} reached after $${spent.toFixed(3)}; stopping.`); break; }
    const r = await generateLean(prompt, j.model);
    const pr = PRICE[j.model] ?? PRICE['gemini-3.1-pro-preview'];
    const cost = (r.tokensIn * pr.in + r.tokensOut * pr.out) / 1e6;
    spent += cost;
    const f = facts.find((x) => x.placeId === j.id && x.interestKey === j.k);
    results.push({
      k: j.k, id: j.id, name: row.name, model: j.model, tokensIn: r.tokensIn, tokensOut: r.tokensOut, cost, parseError: r.parseError, gemini: r.json,
      curve: monthly, base: (row.baseScores as Record<string, number>)[j.k] ?? null,
      approved: { overview: (row.sliderOverview as Record<string, string> | null)?.[j.k] ?? null, monthly: (row.sliderMonthlyWeather as Record<string, unknown> | null)?.[j.k] ?? null },
      columns: f ? (f.facts as Record<string, unknown>) : null,
    });
    writeFileSync(out!, JSON.stringify(results, null, 1));
    console.log(`${j.k.padEnd(13)} ${row.name.slice(0, 26).padEnd(26)} ${j.model.slice(7, 18).padEnd(11)} in ${r.tokensIn} out ${r.tokensOut} $${cost.toFixed(4)}  total $${spent.toFixed(3)}`);
    await new Promise((res) => setTimeout(res, 1200));
  }
  console.log(`done: ${results.length} results, $${spent.toFixed(3)}`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
