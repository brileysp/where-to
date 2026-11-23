// 20 Nov 2026: the owner confirmed Piedmont's scope as the whole region, Alps included ("Piedmont, yes, include alps"; dining, wine, coffee, museums and street food stay city things in their own texts).
// Saves the scope through the same function the admin screen uses (src/lib/places/edit.ts changeScope), which bumps the scope version so data made under the old Alba-only scope is listed as made for a different scope.
// Usage: npx tsx scripts/set-piedmont-scope-nov20.ts
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { installLabelFilter } = await import('../src/lib/places/console-labels'); await installLabelFilter();
  const { changeScope } = await import('../src/lib/places/edit'); const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { db } = await import('../src/lib/db/client'); const { placeIdentity } = await import('../src/lib/db/schema'); const { eq } = await import('drizzle-orm');
  const KEY = JSON.parse(readFileSync(join(__dirname, 'data', 'place-keys-nov18.json'), 'utf8')).keys['piedmont'] ?? 'p0142';
  const show = async (t: string) => { const [r] = await db.select().from(placeIdentity).where(eq(placeIdentity.key, KEY)); console.log(t, JSON.stringify({ label: r.label, level: r.level, anchors: r.anchors, scopeVersion: r.scopeVersion, scopeStatus: r.scopeStatus, scopeNote: r.scopeNote })); };
  await show('BEFORE');
  const res = await changeScope(CLAUDE_ACTOR, KEY, {
    level: 'region',
    anchorsText: 'Turin; the Langhe, Roero and Monferrato hills; the Po Valley rice plain; the western and northern Alps, including Gran Paradiso, Monviso and Monte Rosa; Lake Maggiore and Lake Orta',
    note: 'Widened 20 Nov 2026 by the owner from the draft Alba-only scope to the whole region, Alps included. Hiking, birding, wildlife, architecture and Scenic Landscapes cover the Alps; fine dining, wine, coffee, museums and street food stay with Turin and the Langhe, Roero and Monferrato hills (city things). Hotel prices were sampled in Alba only.',
    changesCoverage: true, confirm: true,
  });
  console.log(res); await show('AFTER'); process.exit(0);
})();
