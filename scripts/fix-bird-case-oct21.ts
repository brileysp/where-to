// 21 Oct 2026: applies the Title Case rule for bird names (see src/lib/text/species-case.ts) to the live texts of birding, wildlife viewing, whale
// watching and safari. Capitalization only: each result must equal the original once case is ignored. Plurals keep their ending.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/fix-bird-case-oct21.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { birdCaseProblems, SPECIES_CASE_INTERESTS } = await import('../src/lib/text/species-case');
  const rows = await db.select().from(places);
  const fixText = (t: string) => {
    let out = t;
    for (const p of birdCaseProblems(t)) out = out.split(p.found).join(p.expected + p.found.slice(p.expected.length));
    return out;
  };
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  const seen = new Map<string, number>(); let texts = 0;
  for (const r of rows) {
    const ov = { ...((r.sliderOverview as Record<string, string>) ?? {}) };
    const mo = { ...((r.sliderMonthlyWeather as Record<string, (string | null)[]>) ?? {}) };
    let changed = false;
    const one = (t: string) => { const f = fixText(t); if (f === t) return t; if (f.toLowerCase() !== t.toLowerCase()) throw new Error(`${r.id}: wording changed`); texts++; changed = true; for (const p of birdCaseProblems(t)) seen.set(`${p.found} -> ${p.expected}`, (seen.get(`${p.found} -> ${p.expected}`) ?? 0) + 1); return f; };
    for (const k of SPECIES_CASE_INTERESTS) {
      if (ov[k]) ov[k] = one(ov[k]);
      if (mo[k]) mo[k] = mo[k].map((t) => (t ? one(t) : t));
    }
    if (!changed) continue;
    const base = { entityType: 'destination', entityId: r.id, loadedUpdatedAt: r.updatedAt.toISOString() };
    patches.push({ ...base, field: 'sliderOverview', value: ov }, { ...base, field: 'sliderMonthlyWeather', value: mo });
  }
  console.log(`${texts} texts in ${patches.length / 2} places would change:`); console.log([...seen.entries()].map(([k, n]) => `  ${n}  ${k}`).join('\n'));
  if (!apply) { console.log('dry run'); process.exit(0); }
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('patches', patches.length, 'saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  process.exit(res.errors.length || res.conflicts.length ? 1 : 0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
