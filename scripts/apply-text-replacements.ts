// 9 Nov 2026: applies exact text replacements to the saved overview and month blurbs of an interest (text only; scores and curves untouched). Input is a JSON list of
// { k, id, old, new }; every replacement must match at least once or the run stops before writing. Old values go to docs/backups first. Dry run unless --apply.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-text-replacements.ts --in=scripts/data/x.json [--apply]
import { existsSync, readFileSync, writeFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
(async () => {
  const apply = process.argv.includes('--apply'); const file = arg('in')!;
  const reps = JSON.parse(readFileSync(join(__dirname, '..', file), 'utf8')) as Array<{ k: string; id: string; old: string; new: string }>;
  const { db } = await import('../src/lib/db/client'); const { places } = await import('../src/lib/db/schema'); const { eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits'); const { SYSTEM_ACTOR } = await import('../src/lib/gemini/apply-actor');
  const byPlace = new Map<string, typeof reps>(); for (const r of reps) { const key = `${r.k}|${r.id}`; byPlace.set(key, [...(byPlace.get(key) ?? []), r]); }
  const plan: Array<{ k: string; id: string; ov: string; months: string[]; before: { ov: string; months: string[] } }> = []; let bad = 0;
  for (const [key, list] of byPlace) {
    const [k, id] = key.split('|'); const [row] = await db.select().from(places).where(eq(places.id, id)); if (!row) { console.log('NO PLACE', id); bad++; continue; }
    let ov: string = (row.sliderOverview as any)?.[k] ?? ''; let months: string[] = [...(((row.sliderMonthlyWeather as any)?.[k] ?? []) as string[])]; const before = { ov, months: [...months] };
    for (const r of list) {
      let n = 0; if (ov.includes(r.old)) { ov = ov.split(r.old).join(r.new); n++; }
      months = months.map((m) => { if (m.includes(r.old)) { n++; return m.split(r.old).join(r.new); } return m; });
      if (!n) { console.log('NO MATCH', key, JSON.stringify(r.old.slice(0, 60))); bad++; }
    }
    plan.push({ k, id, ov, months, before });
  }
  console.log(`${plan.length} places, ${reps.length} replacements, ${bad} problems`);
  if (bad) { console.log('stopped: nothing written'); process.exit(1); }
  if (!apply) { console.log('dry run'); process.exit(0); }
  writeFileSync(join(__dirname, '..', 'docs', 'backups', file.split('/').pop()!.replace('.json', '') + '-before.json'), JSON.stringify(plan.map((p) => ({ k: p.k, id: p.id, ...p.before }))));
  let saved = 0;
  for (const p of plan) {
    const [row] = await db.select().from(places).where(eq(places.id, p.id)); const loaded = row.updatedAt.toISOString();
    const res = await applyAdminEdits([
      { entityType: 'destination', entityId: p.id, field: 'sliderOverview', value: { ...(row.sliderOverview as Record<string, string>), [p.k]: p.ov }, loadedUpdatedAt: loaded },
      { entityType: 'destination', entityId: p.id, field: 'sliderMonthlyWeather', value: { ...(row.sliderMonthlyWeather as Record<string, string[]>), [p.k]: p.months }, loadedUpdatedAt: loaded },
    ] as never, SYSTEM_ACTOR);
    if (res.errors.length || res.conflicts.length) console.log('PROBLEM', p.id, JSON.stringify(res.errors), JSON.stringify(res.conflicts)); else saved++;
  }
  console.log(`saved ${saved} of ${plan.length}`);
  // keep scripts/data/finish/<interest>/results.json in step with the app, so finish-interest.ts never sees these places as unsaved and re-saves the old wording
  const touched = new Set(reps.map((r) => r.k));
  for (const k of touched) {
    const fp = join(__dirname, 'data', 'finish', k, 'results.json'); if (!existsSync(fp)) continue;
    const arr = JSON.parse(readFileSync(fp, 'utf8')) as any[]; let changed = 0;
    for (const r of reps.filter((x) => x.k === k)) for (const c of arr) if (c.k === k && c.id === r.id) {
      const g = c.gemini; if (g.overview.includes(r.old)) { g.overview = g.overview.split(r.old).join(r.new); changed++; }
      for (const b of g.blurbs) if (b.text.includes(r.old)) { b.text = b.text.split(r.old).join(r.new); changed++; }
    }
    writeFileSync(fp, JSON.stringify(arr)); console.log(`${k}: updated ${changed} texts in scripts/data/finish/${k}/results.json`);
  }
  process.exit(0);
})();
