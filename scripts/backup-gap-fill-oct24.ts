// Saves the live text, monthly scores and hand-set score tweaks for the places about to be changed by the 24 Oct 2026 gap fill.
import { readFileSync, writeFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const PAIRS: Array<[string, string]> = [['bahamas','diving'],['borabora','diving'],['cape-town','diving'],['galapagos','diving'],['iceland','diving'],['maldives','diving'],['seychelles','diving'],['bagan','wildlifeViewing'],['kaziranga','wildlifeViewing'],['bagan','birding'],['kaziranga','birding'],['kaziranga','safari'],['morocco','diving'],['charleston-savannah','diving'],['tokyo-kyoto','diving'],['everglades','diving'],['guilin-yangshuo','diving'],['new-orleans','diving'],['hudson-valley','diving'],['ghana','diving'],['venice','diving']];
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const rows = await db.select().from(places);
  const out: Record<string, unknown> = {};
  for (const [id, k] of PAIRS) {
    const p = rows.find((r) => r.id === id) as any;
    out[`${id}:${k}`] = { name: p.name, naSliders: p.naSliders, overview: p.sliderOverview?.[k], blurbs: p.sliderMonthlyWeather?.[k], curve: p.sliderCurves?.[k], overrides: p.scoreOverrides?.[k], meta: p.sliderOverviewMeta?.[k], authoredCurves: p.authoredCurves };
  }
  writeFileSync('docs/backups/gap-fill-before-2026-10-24.json', JSON.stringify(out, null, 1));
  console.log('saved', Object.keys(out).length);
  process.exit(0);
})();
