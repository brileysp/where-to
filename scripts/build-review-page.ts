// 9 Nov 2026: builds a review page for one interest straight from the saved texts and scores in the app, so it can never be stale (the earlier
// pages were built from scratchpad files that were purged or out of date). Writes an HTML file; publishing it stays a manual Artifact step.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/build-review-page.ts --interest=<key> [--only=id,id] [--title="..."] [--alts=file.json] [--flags=file.json] [--out=file.html] [--results=gemini-results.json]
//   --results  build from a Gemini results file (texts not saved yet) instead of the saved texts
//   --alts   { "<placeId>": { "alt": "...", "why": "..." } }  adds a clause-alt choice box under the overview
//   --flags  { "<placeId>": "company name left in because ..." }
// Page template: scripts/data/review-page-template.html. Notes and choices are kept in the artifact database collection "<interest>_review".
import { readFileSync, writeFileSync, mkdirSync } from 'fs'; import { join, resolve } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const readJson = (p?: string) => (p ? JSON.parse(readFileSync(resolve(join(__dirname, '..'), p), 'utf8')) : {});
(async () => {
  const { installLabelFilter } = await import('../src/lib/places/console-labels'); await installLabelFilter(); // standard D03: a report never prints a place key
  const LABELS: Record<string, string> = { scenicLandscapes: 'Scenic Landscapes', stargazing: 'Stargazing', sunbathing: 'Sunbathing', spaWellness: 'Spa & Wellness' };
  const ks = (arg('interest') ?? '').split(',').filter(Boolean); const k = ks[0]; if (!k) { console.log('Usage: --interest=<key>[,<key>...] [--only=a,b] [--title=...] [--alts=file] [--flags=file] [--out=file]'); process.exit(1); }
  const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows'); const { scorePlace } = await import('../src/lib/db/queries/places'); const { scanText, scanStructure } = await import('../src/lib/authoring/rules'); const { oldRuleHits } = await import('../src/lib/authoring/old-rules');
  const { resolvePlaceEntries } = await import('../src/lib/places/script-args'); const onlyRaw = arg('only')?.split(','); const only = onlyRaw ? await resolvePlaceEntries(onlyRaw) : undefined; /* 18 Nov 2026: slugs and old ids work, as well as keys */ const alts = readJson(arg('alts')); const flags = readJson(arg('flags')); const drinks = k === 'wineSpirits' || k === 'coffeeTea'; const collKey = ks.length > 1 ? (arg('key') ?? ks.join('-')) : k;
  const rows = (await getPrimaryPlaceRows()) as any[]; const data: any[] = [];
  if (arg('results')) {
    const names = new Map(rows.map((r) => [r.id, r])); const multi = ks.length > 1; const LABEL: Record<string, string> = { scenicLandscapes: 'Scenic Landscapes', stargazing: 'Stargazing', sunbathing: 'Sunbathing', spaWellness: 'Spa & Wellness' };
    for (const x of readJson(arg('results')) as any[]) { if (!ks.includes(x.k) || !x.gemini?.applicable || (only && !only.includes(multi ? `${x.k}|${x.id}` : x.id))) continue; const g = x.gemini; const r = names.get(x.id); const note = alts[`${x.k}|${x.id}`] ?? alts[x.id];
      const old = r ? ((scorePlace(r) as any).monthly[x.k] as number[] | undefined) : undefined; const sk = x.k === 'stargazing';
      data.push({ grp: multi ? (LABEL[x.k] ?? x.k) : undefined, id: multi ? `${x.k}__${x.id}` : x.id, name: `${r?.name ?? x.name}${multi ? ` \u2014 ${LABEL[x.k] ?? x.k}` : ''}`, type: r?.placeType ?? 'place', depth: g.blurbs.length === 1 ? 'year' : g.blurbs.length <= 4 ? 'groups' : 'months', fin: g.monthly_scores, gem: x.gemini_scores ?? g.gemini_scores ?? g.monthly_scores, ours: old?.map((v) => Math.round(v * 10) / 10), ov: g.overview, bl: g.blurbs.map((b: any) => ({ m: b.months, lv: b.level, t: b.text })), scan: [...scanText(g.overview, g.blurbs.map((b: any) => b.text), { drinks: x.k === 'wineSpirits' || x.k === 'coffeeTea', sky: sk }), ...scanStructure(g.blurbs.map((b: any) => ({ months: b.months, text: b.text })), g.monthly_scores), ...oldRuleHits(g, x.k, x.id, r?.countryCode).map((h) => h.id)], why: note?.why, flag: flags[`${x.k}|${x.id}`] ?? flags[x.id] }); }
  }
  for (const r of rows) {
    if (arg('results')) break;
    const ov = (r.sliderOverview as any)?.[k]; const wx = (r.sliderMonthlyWeather as any)?.[k] as string[] | undefined; if (!ov || !wx || (only && !only.includes(r.id))) continue;
    const fin = ((scorePlace(r) as any).monthly[k] as number[]).map((v) => Math.round(v * 10) / 10);
    const groups: Array<{ m: number[]; t: string }> = []; wx.forEach((t, i) => { const g = groups.find((x) => x.t === t); if (g) g.m.push(i + 1); else groups.push({ m: [i + 1], t }); });
    const a = alts[r.id];
    data.push({ id: r.id, name: r.name, type: r.placeType ?? 'place', depth: groups.length === 1 ? 'year' : groups.length <= 4 ? 'groups' : 'months', fin, ov, bl: groups.map((g) => ({ m: g.m, lv: '', t: g.t })), scan: [...scanText(ov, groups.map((g) => g.t), { drinks, sky: k === 'stargazing' }), ...scanStructure(groups.map((g) => ({ months: g.m, text: g.t })), fin), ...oldRuleHits({ overview: ov, blurbs: groups.map((g) => ({ months: g.m, text: g.t })), monthly_scores: fin }, k, r.id, r.countryCode).map((h) => h.id)], alt: a?.alt, altwhy: a?.why, flag: flags[r.id] });
  }
  if (ks.length > 1) data.sort((a, b) => ks.findIndex((q) => (LABELS[q] ?? q) === a.grp) - ks.findIndex((q) => (LABELS[q] ?? q) === b.grp) || a.name.localeCompare(b.name));
  const title = arg('title') ?? `${k} review`; const tpl = readFileSync(join(__dirname, 'data', 'review-page-template.html'), 'utf8');
  const intro = `<div class="box"><h3>How to use this page</h3><ul><li>${arg('results') ? 'These texts are Gemini\'s output after my fact-check and trimming; they are not saved in the app yet.' : `Every text and score here is read from the app at the moment this page was built (${new Date().toISOString().slice(0, 10)}), not from a scratch file.`}</li><li>Length counters compare each text with the maximum for its peak score. The bar at the top moves between places; a note box on each card saves as you leave it.</li><li>Tick "make this a rule" if a note should apply to every interest.</li></ul></div>`;
  const html = tpl.replace(/__TITLE__/g, title).replace('__SUB__', `${data.length} places${arg('results') ? ', waiting for your read.' : ', read live from the app.'}`).replace('__INTRO__', intro).replace('__DATA__', () => JSON.stringify(data)).replace('__KEY__', collKey).replace('__COLL__', `${collKey}_review`);
  const out = arg('out') ?? join(__dirname, '..', '.cache', `review-${k}.html`); mkdirSync(join(out, '..'), { recursive: true }); writeFileSync(out, html);
  console.log(`${data.length} places written to ${out}`); process.exit(0);
})();
