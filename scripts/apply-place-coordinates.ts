// Fills latitude and longitude for every place (17 Oct 2026), from scripts/data/place-coordinates-oct17.json: one representative point per
// place (its main gateway or the centre of the area; broad places have a note). Only fills places that have no coordinates yet.
// Used for estimating flight hours in the new onboarding's shortlist (src/lib/onboarding/shortlist.ts).
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-place-coordinates.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';

for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
}

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { milesBetween } = await import('../src/lib/onboarding/airports');
  const { DESTINATION_LOCATIONS } = await import('../src/lib/scoring/destinationLocations');
  const data = JSON.parse(readFileSync(join(__dirname, 'data', 'place-coordinates-oct17.json'), 'utf8')) as Record<string, [number, number, string?]>;
  const rows = await db.select({ id: places.id, lat: places.latitude, lon: places.longitude }).from(places);
  const known = new Set(rows.map((r) => r.id));
  const missing = rows.filter((r) => !data[r.id]).map((r) => r.id);
  const extra = Object.keys(data).filter((id) => !known.has(id));
  if (missing.length || extra.length) throw new Error(`ids differ. Missing: ${missing.join(', ')}. Not in the database: ${extra.join(', ')}`);
  for (const [id, [lat, lon]] of Object.entries(data)) if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) throw new Error(`bad coordinates for ${id}`);

  // Sanity check: places in the same country should not be implausibly far apart.
  const byCountry = new Map<string, string[]>();
  for (const [id, loc] of Object.entries(DESTINATION_LOCATIONS)) (byCountry.get(`${loc.type}:${loc.code}`) ?? byCountry.set(`${loc.type}:${loc.code}`, []).get(`${loc.type}:${loc.code}`)!).push(id);
  const far: string[] = [];
  for (const [c, ids] of byCountry) {
    if (['country:USA', 'country:CAN', 'country:RUS', 'country:AUS', 'country:BRA', 'country:CHN', 'country:IND', 'country:ARG', 'country:CHL', 'country:ATA'].includes(c)) continue;
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      const A = data[ids[a]], B = data[ids[b]];
      if (!A || !B) continue;
      const mi = milesBetween({ lat: A[0], lon: A[1] }, { lat: B[0], lon: B[1] });
      if (mi > 1300) far.push(`${c}: ${ids[a]} to ${ids[b]} ${Math.round(mi)} miles`);
    }
  }
  console.log(far.length ? `Far apart within one country (check):\n  ${far.join('\n  ')}` : 'No same-country pairs further than 1,300 miles apart.');

  let n = 0;
  for (const r of rows) {
    if (r.lat != null && r.lon != null) continue;
    const [lat, lon] = data[r.id];
    if (apply) await db.update(places).set({ latitude: lat, longitude: lon }).where(eq(places.id, r.id));
    n++;
  }
  console.log(`${apply ? 'filled' : 'would fill'} ${n} of ${rows.length} places`);
  process.exit(0);
})();
