// 2 Nov 2026: applies the owner's length-review edits for Street Food (28 places): replaces the overview and/or the month blurbs only. Scores and curves are NOT touched
// (the rank moves were saved after the first Street Food save, so re-running the family save would undo them). Old texts go to docs/backups first. Dry run unless --apply.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-street-food-length-edits-nov2.ts [--apply]
import { readFileSync, writeFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply'); const K = 'streetFood'; const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean); // --only=id,id re-applies a few places (backup then goes to a second file)
  const edits = JSON.parse(readFileSync(join(__dirname, 'data', 'street-food-length-edits-nov2.json'), 'utf8')) as Record<string, { overview?: string; blurbs?: Array<{ months: number[]; text: string }> }>;
  const { db } = await import('../src/lib/db/client'); const { places } = await import('../src/lib/db/schema'); const { eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits'); const { SYSTEM_ACTOR } = await import('../src/lib/gemini/apply-actor');
  const backup: any[] = []; let saved = 0, problems = 0;
  for (const [id, e] of Object.entries(edits)) {
    if (only.length && !only.includes(id)) continue;
    const [row] = await db.select().from(places).where(eq(places.id, id)); if (!row) { console.log('NO PLACE', id); problems++; continue; }
    const ovAll = (row.sliderOverview as Record<string, string>) ?? {}; const moAll = (row.sliderMonthlyWeather as Record<string, string[]>) ?? {};
    const months = [...(moAll[K] ?? new Array(12).fill(''))];
    backup.push({ id, overview: ovAll[K], months: moAll[K] });
    for (const b of e.blurbs ?? []) for (const m of b.months) months[m - 1] = b.text;
    const overview = e.overview ?? ovAll[K];
    console.log(`${id.padEnd(26)} ${e.overview ? 'overview ' + overview.length : ''} ${(e.blurbs ?? []).map((b) => 'blurb(' + b.months.length + ' months) ' + b.text.length).join(', ')}`);
    if (!apply) continue;
    const loaded = row.updatedAt.toISOString();
    const patches: any[] = [];
    if (e.overview) patches.push({ entityType: 'destination', entityId: id, field: 'sliderOverview', value: { ...ovAll, [K]: overview }, loadedUpdatedAt: loaded });
    if (e.blurbs) patches.push({ entityType: 'destination', entityId: id, field: 'sliderMonthlyWeather', value: { ...moAll, [K]: months }, loadedUpdatedAt: loaded });
    const res = await applyAdminEdits(patches as never, SYSTEM_ACTOR);
    if (res.errors.length || res.conflicts.length) { problems++; console.log('PROBLEM', id, JSON.stringify(res.errors), JSON.stringify(res.conflicts)); } else saved++;
  }
  if (apply) writeFileSync(join(__dirname, '..', 'docs', 'backups', only.length ? 'street-food-length-edits-nov2-second-before.json' : 'street-food-length-edits-nov2-before.json'), JSON.stringify(backup));
  console.log(apply ? `saved ${saved} of ${Object.keys(edits).length}, problems ${problems}` : `dry run, problems ${problems}`);
  process.exit(0);
})();
