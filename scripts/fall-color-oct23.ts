// 23 Oct 2026 (owner, fall-color step): rewrites 13 places already scored for Blooms and Fall Colors so their overview, monthly text and monthly scores include
// the fall-color season, and switches the interest ON for 18 more places known for fall color, with new text and scores. Text and scores are in
// scripts/data/fall-color-text-oct23.json (sc = 12 monthly scores, ov = overview, mo = 12 monthly texts, on = switched on now). Written by Claude directly
// (the interest has not been through the Gemini pipeline); dates checked against web searches, nothing marked source-checked. The 12 monthly scores are saved as
// both the curve (12 anchors) and the monthly overrides, so nothing stale is left behind. Old values of the 13 are saved to docs/backups.
// After this run the facts: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-blooms-facts.ts --apply --overwrite=c,g
// A DRY RUN unless --apply. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/fall-color-oct23.ts [--apply]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const K = 'wildflowerBlooms';
(async () => {
  const apply = process.argv.includes('--apply');
  const data = JSON.parse(readFileSync(join(__dirname, 'data', 'fall-color-text-oct23.json'), 'utf8')) as Record<string, { sc: number[]; ov: string; mo: string[]; on: boolean }>;
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { parseSliderCurve } = await import('../src/lib/scoring/curve');
  const rows = await db.select().from(places);
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  const backup: Record<string, unknown> = {};
  for (const [id, d] of Object.entries(data)) {
    const r = rows.find((x) => x.id === id);
    if (!r) throw new Error(`no place ${id}`);
    if (d.sc.length !== 12 || d.mo.length !== 12 || d.mo.some((t) => !t)) throw new Error(`${id}: needs 12 scores and 12 texts`);
    const isNA = (r.naSliders ?? []).includes(K);
    if (d.on !== isNA) throw new Error(`${id}: expected ${d.on ? 'switched off' : 'switched on'} but it is ${isNA ? 'off' : 'on'}`);
    const P = (field: string, value: unknown) => patches.push({ entityType: 'destination', entityId: id, field, value, loadedUpdatedAt: r.updatedAt.toISOString() });
    if (!d.on) backup[id] = { overview: (r.sliderOverview as Record<string, string>)[K], monthly: (r.sliderMonthlyWeather as Record<string, unknown>)[K], curve: (r.sliderCurves as Record<string, unknown>)[K] ?? null, overrides: (r.scoreOverrides as Record<string, unknown>)?.[K] ?? null };
    if (d.on) {
      const reasons = { ...((r.naReasons as Record<string, unknown>) ?? {}) }; delete reasons[K];
      P('naSliders', (r.naSliders ?? []).filter((k) => k !== K));
      P('naReasons', reasons);
    }
    const curve = parseSliderCurve({ anchors: d.sc.map((value, i) => ({ month: i + 1, value, steepness: 1 })) });
    P('sliderCurves', { ...(r.sliderCurves as Record<string, unknown>), [K]: curve });
    P('scoreOverrides', { ...((r.scoreOverrides as Record<string, unknown>) ?? {}), [K]: Object.fromEntries(d.sc.map((v, i) => [String(i), v])) });
    P('sliderOverview', { ...((r.sliderOverview as Record<string, string>) ?? {}), [K]: d.ov });
    P('sliderMonthlyWeather', { ...((r.sliderMonthlyWeather as Record<string, unknown>) ?? {}), [K]: d.mo });
    console.log(`${d.on ? 'ON     ' : 'REWRITE'} ${id.padEnd(26)} peak ${Math.max(...d.sc)}`);
  }
  console.log(Object.keys(data).length, 'places,', patches.length, 'patches');
  if (!apply) { console.log('dry run'); process.exit(0); }
  writeFileSync(join(__dirname, '..', 'docs', 'backups', 'blooms-before-fall-color-2026-10-23.json'), JSON.stringify(backup, null, 1));
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  process.exit(res.errors.length || res.conflicts.length ? 1 : 0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
