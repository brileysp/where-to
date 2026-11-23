// 9 Nov 2026: builds the place facts that go into the Gemini prompt for the practice batch of Scenic Landscapes, Stargazing, Sunbathing and Spa & Wellness
// (scripts/data/pilot-set-nov9.json): computed darkness hours, measured night cloud / sunshine / rainy days from Open-Meteo archive data (2021 to 2023 for hourly
// cloud, 2019 to 2023 for daily), and our own recorded ratings. Writes scripts/data/pilot-facts-nov9.json, one text block per "interest|place".
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/build-pilot-facts.ts [--no-weather]
import { readFileSync, writeFileSync, existsSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const argv = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const OUT = join(__dirname, 'data', argv('out') ?? 'pilot-facts-nov9.json'); const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function getJson(url: string): Promise<any> { for (let a = 0; a < 6; a++) { try { const r = await fetch(url); if (r.ok) return await r.json(); if (r.status === 429) { await sleep(20000 * (a + 1)); continue; } await sleep(5000); } catch { await sleep(5000 * (a + 1)); } } throw new Error('Open-Meteo kept failing'); }
const fmt = (a: number[], d = 0) => MONTHS.map((m, i) => `${m} ${a[i].toFixed(d)}`).join(', ');
async function nightCloud(lat: number, lng: number): Promise<number[]> {
  const j = await getJson(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=2021-01-01&end_date=2023-12-31&hourly=cloud_cover&timezone=auto`);
  const sum = new Array(12).fill(0), n = new Array(12).fill(0);
  j.hourly.time.forEach((t: string, i: number) => { const h = +t.slice(11, 13); if (h >= 22 || h < 4) { const m = +t.slice(5, 7) - 1; const v = j.hourly.cloud_cover[i]; if (v != null) { sum[m] += v; n[m]++; } } });
  return sum.map((s, m) => (n[m] ? s / n[m] : NaN));
}
async function dayWeather(lat: number, lng: number): Promise<{ sun: number[]; rainy: number[] }> {
  const j = await getJson(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=2019-01-01&end_date=2023-12-31&daily=sunshine_duration,precipitation_sum&timezone=auto`);
  const sun = new Array(12).fill(0), rain = new Array(12).fill(0), days = new Array(12).fill(0);
  j.daily.time.forEach((t: string, i: number) => { const m = +t.slice(5, 7) - 1; if (j.daily.sunshine_duration[i] != null) { sun[m] += j.daily.sunshine_duration[i] / 3600; days[m]++; if ((j.daily.precipitation_sum[i] ?? 0) >= 1) rain[m]++; } });
  return { sun: sun.map((s, m) => s / days[m]), rainy: rain.map((r, m) => (r / days[m]) * 30.4) };
}
const rt = (o: any, keys: Array<[string, string]>) => keys.filter(([k]) => typeof o?.[k] === 'number').map(([k, l]) => `${l} ${o[k]}`).join('; ');
(async () => {
  const { installLabelFilter } = await import('../src/lib/places/console-labels'); await installLabelFilter(); // standard D03: a report never prints a place key
  const noWeather = process.argv.includes('--no-weather'); const set = JSON.parse(readFileSync(join(__dirname, 'data', argv('set') ?? 'pilot-set-nov9.json'), 'utf8')) as Record<string, string[]>;
  const { getPrimaryPlaceRows } = await import('../src/lib/db/queries/primary-place-rows'); const { db } = await import('../src/lib/db/client'); const { placeInterestFacts } = await import('../src/lib/db/schema'); const { inArray } = await import('drizzle-orm');
  const { darkHoursByMonth, lowestSunAltitudeByMonth } = await import('../src/lib/astro/darkness');
  const keys = Object.keys(set); const facts = await db.select().from(placeInterestFacts).where(inArray(placeInterestFacts.interestKey, keys)); const rows = (await getPrimaryPlaceRows()) as any[];
  const out: Record<string, string> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
  for (const k of keys) for (const id of set[k]) {
    const cell = `${k}|${id}`; if (out[cell]) continue; const r = rows.find((x) => x.id === id); if (!r) throw new Error(`no place ${id}`); const f = (facts.find((x) => x.placeId === id && x.interestKey === k)?.facts ?? {}) as any; const lines: string[] = [];
    const pt = `Figures below are for one representative point (latitude ${r.latitude.toFixed(1)}, longitude ${r.longitude.toFixed(1)}); for a large place the best sites may differ.`;
    if (k === 'stargazing') {
      lines.push(`Hours of astronomical darkness (the sun more than 18 degrees below the horizon) on the middle day of each month, computed from latitude: ${fmt(darkHoursByMonth(r.latitude), 1)}. 0 means the sky never gets fully dark.`);
      lines.push(`The sun's lowest height at night on the middle day of each month, in degrees from the horizon (computed from latitude; negative means below the horizon, positive means the sun stays above it all night): ${fmt(lowestSunAltitudeByMonth(r.latitude), 0)}. Below -18 the sky is fully dark; -18 to -12 most stars still show; -12 to -9 only the brightest stars and planets; -9 to -6 a few of the very brightest; above -6 (twilight all night, or the sun above the horizon) no star shows at all.`);
      if (!noWeather) { lines.push(`Average cloud cover between 10 pm and 4 am local time, 2021 to 2023 (percent): ${fmt(await nightCloud(r.latitude, r.longitude))}.`); await sleep(1500); }
      lines.push(`Our recorded ratings (drafts, not source-checked): sky darkness Bortle class ${f.bortle ?? 'unknown'} for the best sky within about two hours' drive; ${rt(f, [['clearHighSkies', 'clear high skies (0-10)'], ['skyPhotography', 'night sky photography (0-10)']])}; certified dark-sky place ${f.darkSkyCertified ? 'yes' : 'no'}; nights at the best sites usually ${f.nightConditions ?? 'unknown'}.`);
    } else if (k === 'sunbathing') {
      if (f.afternoonHighsF) lines.push(`Typical afternoon highs by month, degrees F (climate tables): ${MONTHS.map((m, i) => `${m} ${f.afternoonHighsF.split(',')[i]}`).join(', ')}.`);
      if (!noWeather) { const w = await dayWeather(r.latitude, r.longitude); lines.push(`Average hours of sunshine per day, 2019 to 2023: ${fmt(w.sun, 1)}.`); lines.push(`Days per month with at least 0.04 inch of rain, 2019 to 2023: ${fmt(w.rainy)}.`); await sleep(1500); }
      lines.push(`Our recorded ratings (drafts, not source-checked, 0-10): ${rt(f, [['beachClubs', 'beach clubs and loungers'], ['quietShores', 'quiet shores'], ['resortPoolDays', 'resort pool days'], ['calmShores', 'calm low-wind shores']])}.`);
    } else if (k === 'scenicLandscapes') {
      lines.push(`Our recorded ratings for the landscape types (drafts, not source-checked, 0-10, each against the best of that type in the world): ${rt(f, [['mountainsRating', 'mountains'], ['desertsRating', 'deserts and canyons'], ['coastsRating', 'coasts'], ['forestsRating', 'forests'], ['citiesRating', 'cities and villages'], ['lakesRating', 'lakes, rivers and waterfalls'], ['iceRating', 'polar, glaciers and ice'], ['iconicRating', 'iconic signature view'], ['hiddenGemsRating', 'quiet scenery beyond the icons']])}.`);
      if (f.signatureViews) lines.push(`Signature views: ${f.signatureViews}`);
    } else if (k === 'spaWellness') {
      lines.push(`Our recorded ratings (drafts, not source-checked, 0-10): ${rt(f, [['daySpas', 'day spas and massage'], ['thermalBaths', 'thermal baths and hammams'], ['wellnessResorts', 'wellness resort stays'], ['clinicalWellness', 'clinical and medical wellness']])}.`);
    }
    if (k === 'stargazing' || k === 'sunbathing') lines.push(pt);
    out[cell] = lines.join('\n'); writeFileSync(OUT, JSON.stringify(out, null, 1)); process.stdout.write('.');
  }
  console.log(`\n${Object.keys(out).length} cells have facts -> ${OUT}`); process.exit(0);
})();
