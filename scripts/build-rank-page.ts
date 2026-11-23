// 9 Nov 2026: builds the rank-check page for one interest from the saved scores and the evidence columns in the app (place_interest_facts),
// so it always matches what is live. Optional moves file (same shape as scripts/data/rank-moves-*.json, plus a "why" on each move) highlights
// suggested changes with Accept/Decline. Writes an HTML file; publishing stays a manual Artifact step.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/build-rank-page.ts --interest=<key> [--moves=scripts/data/<file>.json] [--results=<gemini results file>] [--groups=<file {id: group label}>] [--nocols] [--title="..."] [--out=file.html]
//   --nocols   (21 Nov 2026) leave out the rating evidence columns (a gut-check page)
//   --groups   (21 Nov 2026) group places by this label instead of the place type (Scenic Landscapes groups by kind of landscape)
//   --results  (21 Nov 2026) read the "as saved" scores from a staged Gemini results file instead of the app, for an interest that is not live yet (Scenic Landscapes)
import { readFileSync, writeFileSync, mkdirSync } from 'fs'; import { join, resolve } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const TYPE_LABEL: Record<string, string> = { city: 'Cities', region: 'Regions', country: 'Countries', island: 'Islands', coastal_area: 'Coastal areas', state_province: 'States and provinces', national_park: 'Parks', wilderness: 'Wilderness', wilderness_area: 'Wilderness' };
(async () => {
  const k = arg('interest'); if (!k) { console.log('Usage: --interest=<key> [--moves=file] [--title=...] [--out=file]'); process.exit(1); }
  const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows'); const { scorePlace } = await import('../src/lib/db/queries/places');
  const { visibleFactDefs } = await import('../src/lib/admin/interest-pages/config'); const { db } = await import('../src/lib/db/client'); const { placeInterestFacts } = await import('../src/lib/db/schema'); const { eq } = await import('drizzle-orm');
  const cols = process.argv.includes('--nocols') ? [] : visibleFactDefs(k).filter((d) => d.type === 'int' || d.type === 'rating').map((d) => ({ key: d.key, label: d.label.split(/ and | & /)[0].split(' ').slice(0, 2).join(' ') }));
  const factRows = await db.select().from(placeInterestFacts).where(eq(placeInterestFacts.interestKey, k)); const facts = new Map(factRows.map((f) => [f.placeId, f.facts as Record<string, unknown>]));
  const moves: Record<string, { to: number; why?: string }> = {}; if (arg('moves')) for (const m of JSON.parse(readFileSync(resolve(join(__dirname, '..'), arg('moves')!), 'utf8')) as any[]) moves[m.id] = { to: m.to, why: m.why };
  const rows = (await getPrimaryPlaceRows()) as any[]; const data: any[] = [];
  const groupsBy: Record<string, string> | null = arg('groups') ? JSON.parse(readFileSync(resolve(join(__dirname, '..'), arg('groups')!), 'utf8')) : null;
  const staged = arg('results') ? new Map((JSON.parse(readFileSync(resolve(join(__dirname, '..'), arg('results')!), 'utf8')) as any[]).filter((x) => x.k === k && x.gemini?.applicable).map((x) => [x.id as string, x.gemini.monthly_scores as number[]])) : null;
  for (const r of rows) {
    if (staged ? !staged.has(r.id) : !(r.sliderOverview as any)?.[k]) continue; const fin = (staged ? staged.get(r.id)! : ((scorePlace(r) as any).monthly[k] as number[])).map((v) => Math.round(v * 10) / 10); const f = facts.get(r.id) ?? {};
    data.push({ id: r.id, name: r.name, type: groupsBy?.[r.id] ?? TYPE_LABEL[r.placeType ?? ''] ?? 'Other places', peak: Math.max(...fin), low: Math.min(...fin), f: Object.fromEntries(cols.map((c) => [c.key, typeof f[c.key] === 'number' ? f[c.key] : null])), mv: moves[r.id] ? { to: moves[r.id].to, why: moves[r.id].why ?? 'No reason recorded.' } : null });
  }
  for (const id of Object.keys(moves)) if (!data.some((d) => d.id === id)) console.log(`WARNING: move for ${id} matches no place with text`);
  const title = arg('title') ?? `${k} rank check`; const nm = Object.keys(moves).length; const tpl = readFileSync(join(__dirname, 'data', 'rank-page-template.html'), 'utf8');
  const sub = `${data.length} places read ${staged ? 'from the staged results (not saved in the app yet)' : 'live from the app'} on ${new Date().toISOString().slice(0, 10)}. First each place against others of its kind, then all together. ${nm ? `${nm} moves are suggested, highlighted; press Accept or Decline and add a note (or a number if you want a different peak). Nothing changes until you tell me to apply them.` : 'No moves are suggested; add a note on any place that looks out of order.'}`;
  const html = tpl.replace(/__TITLE__/g, title).replace('__SUB__', sub).replace('__INTRO__', '').replace('__COLS__', () => JSON.stringify(cols)).replace('__KEY__', k).replace('__COLL__', `${k}_rank`).replace('__DATA__', () => JSON.stringify(data));
  const out = arg('out') ?? join(__dirname, '..', '.cache', `rank-${k}.html`); mkdirSync(join(out, '..'), { recursive: true }); writeFileSync(out, html);
  console.log(`${data.length} places, ${cols.length} evidence columns (${cols.map((c) => c.label).join(', ')}) written to ${out}`); process.exit(0);
})();
