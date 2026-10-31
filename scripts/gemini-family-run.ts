// 31 Oct 2026: runs one family of interests through the family directive (prompts/family-v1.md + prompts/_shared/authoring-core.md + scripts/data/family-scopes.json)
// for a few sample places per interest. Gemini is sent only the place; our scores and columns are read here only to be saved beside the answer for the checks.
// Nothing is written to the database. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/gemini-family-run.ts --family=culture --out=file.json [--per=3] [--budget=1.5] [--dry]
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const KIND: Record<string, string> = { country: 'a whole country', region: 'a region', state_province: 'a state or province', island: 'an island or island group', city: 'a city', neighborhood: 'a neighborhood', national_park: 'a national park', wilderness_area: 'a wilderness area', coastal_area: 'a coastal area', day_trip: 'a day trip' };
const strip = (t: string) => t.replace(/<!--[\s\S]*?-->/g, '').trim();
(async () => {
  const families = (arg('family') ?? '').split(',').filter(Boolean);
  const out = arg('out'); const dry = process.argv.includes('--dry');
  if (!families.length || (!out && !dry)) { console.log('Usage: --family=culture,food --out=file.json [--per=3] [--budget=1.5] [--dry]'); process.exit(1); }
  const per = Number(arg('per') ?? '3'); const budget = Number(arg('budget') ?? '1.5');
  const root = join(__dirname, '..');
  const scopes = JSON.parse(readFileSync(join(__dirname, 'data', 'family-scopes.json'), 'utf8')) as Record<string, { title: string; interests: Record<string, { label: string; about: string; notCount: string; scope: string }> }>;
  const template = strip(readFileSync(join(root, 'prompts', 'family-v1.md'), 'utf8'));
  const core = strip(readFileSync(join(root, 'prompts', '_shared', 'authoring-core.md'), 'utf8'));
  const { db } = await import('../src/lib/db/client');
  const { places, placeInterestFacts } = await import('../src/lib/db/schema');
  const { scorePlace } = await import('../src/lib/db/queries/places');
  const { generateLean, MODEL } = await import('../src/lib/gemini/client');
  const rows = await db.select().from(places);
  const facts = await db.select().from(placeInterestFacts);
  const jobs: Array<{ family: string; k: string; id: string; rank: string }> = [];
  for (const fam of families) {
    for (const k of Object.keys(scopes[fam].interests)) {
      const app = rows.filter((r) => !r.naSliders.includes(k)).map((r) => { const s: any = scorePlace(r as never); const m: number[] | undefined = (s.scores ?? s.monthly ?? {})[k]; return { id: r.id, peak: m ? Math.max(...m) : 0 }; }).sort((a, b) => b.peak - a.peak);
      const idx = per === 3 ? [Math.floor(app.length * 0.04), Math.floor(app.length * 0.5), Math.floor(app.length * 0.9)] : Array.from({ length: per }, (_, i) => Math.floor((app.length * (i + 0.5)) / per));
      const labels = ['strong', 'middle', 'weak'];
      idx.forEach((ix, n) => jobs.push({ family: fam, k, id: app[Math.min(ix, app.length - 1)].id, rank: per === 3 ? labels[n] : String(n) }));
    }
  }
  const results: any[] = out && existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : [];
  let spent = results.reduce((a, r) => a + r.cost, 0);
  for (const j of jobs) {
    if (results.some((r) => r.k === j.k && r.id === j.id)) continue;
    const row = rows.find((r) => r.id === j.id)!;
    const s: any = scorePlace(row as never);
    const monthly: number[] = (s.scores ?? s.monthly ?? {})[j.k];
    const fam = scopes[j.family];
    const table = ['| Interest | It is about | Does not count toward it |', '|---|---|---|', ...Object.values(fam.interests).map((i) => `| ${i.label} | ${i.about} | ${i.notCount} |`)].join('\n');
    const place = `${row.name} (${KIND[row.placeType ?? ''] ?? 'a place'}; ${row.region}${row.countryCode ? `, ${row.countryCode}` : ''})`;
    const prompt = template.replace('{{PLACE}}', place).replace(/\{\{LABEL\}\}/g, fam.interests[j.k].label).replace('{{SCOPE}}', fam.interests[j.k].scope).replace('{{FAMILY_TABLE}}', table).replace('{{CORE}}', core);
    if (dry) { console.log(prompt); console.log('\n~ chars', prompt.length); process.exit(0); }
    if (spent >= budget) { console.log(`Budget cap $${budget} reached after $${spent.toFixed(3)}; stopping.`); break; }
    const r = await generateLean(prompt, MODEL);
    const cost = (r.tokensIn * 2 + r.tokensOut * 12) / 1e6; spent += cost;
    const f = facts.find((x) => x.placeId === j.id && x.interestKey === j.k);
    results.push({ family: j.family, k: j.k, id: j.id, rank: j.rank, name: row.name, model: MODEL, tokensIn: r.tokensIn, tokensOut: r.tokensOut, cost, parseError: r.parseError, gemini: r.json, curve: monthly, base: (row.baseScores as Record<string, number>)[j.k] ?? null, columns: f ? (f.facts as Record<string, unknown>) : null });
    writeFileSync(out!, JSON.stringify(results, null, 1));
    console.log(`${j.k.padEnd(18)} ${j.rank.padEnd(7)} ${row.name.slice(0, 24).padEnd(24)} in ${r.tokensIn} out ${r.tokensOut} $${cost.toFixed(4)} total $${spent.toFixed(3)}`);
    await new Promise((res) => setTimeout(res, 1200));
  }
  console.log(`done: ${results.length} results, $${spent.toFixed(3)}`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
