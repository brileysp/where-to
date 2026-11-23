// 2 Nov 2026: saves the current values of one interest's fields for every place, before a batch of new text and scores is applied. Usage: npx tsx scripts/backup-interest-fields-nov2.ts <interestKey> <outfile>
import { readFileSync, writeFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const k = process.argv[2]; const out = process.argv[3];
  const { db } = await import('../src/lib/db/client'); const { places } = await import('../src/lib/db/schema');
  const rows = await db.select().from(places);
  const pick = (o: any) => (o && typeof o === 'object' ? o[k] ?? null : null);
  const data = rows.map((p: any) => ({ id: p.id, sliderCurves: pick(p.sliderCurves), baseScores: pick(p.baseScores), sliderOverview: pick(p.sliderOverview), sliderMonthlyWeather: pick(p.sliderMonthlyWeather), sliderOverviewMeta: pick(p.sliderOverviewMeta), sliderMonthlyWeatherMeta: pick(p.sliderMonthlyWeatherMeta), scoreOverrides: pick(p.scoreOverrides) })).filter((r) => Object.values(r).some((v, i) => i > 0 && v !== null));
  writeFileSync(join(__dirname, '..', out), JSON.stringify(data));
  console.log(`${rows.length} places read, ${data.length} with ${k} data saved to ${out}`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
