import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Fixes the stray capital in the Sri Lanka safari text ("Asian elephant Gathering" -> "gathering"), 7 Oct 2026.
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const [r] = await db.select().from(places).where(eq(places.id, 'srilanka'));
  const ov = { ...((r.sliderOverview as Record<string, string>) ?? {}) };
  const mo = { ...((r.sliderMonthlyWeather as Record<string, (string | null)[]>) ?? {}) };
  const fix = (s: string) => s.replace(/(\*\*Asian elephant\*\*) Gathering/g, '$1 gathering');
  const before = ov.safari + '\n' + (mo.safari ?? []).join('\n');
  ov.safari = fix(ov.safari);
  mo.safari = (mo.safari ?? []).map((t) => (t == null ? t : fix(t)));
  const after = ov.safari + '\n' + mo.safari.join('\n');
  console.log('Gathering before:', (before.match(/Gathering/g) ?? []).length, 'after:', (after.match(/Gathering/g) ?? []).length);
  const base = { entityType: 'destination', entityId: 'srilanka', loadedUpdatedAt: r.updatedAt.toISOString() };
  const res = await applyAdminEdits([{ ...base, field: 'sliderOverview', value: ov }, { ...base, field: 'sliderMonthlyWeather', value: mo }], CLAUDE_ACTOR);
  console.log('saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  process.exit(0);
})();
