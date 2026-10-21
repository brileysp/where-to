// 21 Oct 2026: one-line "why this interest does not apply here" for places marked N/A that have no reason yet (never overwrites one).
//  - Safari: 183 places. A plain sentence by kind of place; wildlife-led places point to Wildlife Viewing. Drafts for the owner to skim in the Places & data tab.
//  - Diving: Chicago.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/store-na-reasons-oct21.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

const SAFARI_BY_TYPE: Record<string, string> = {
  city: 'A city break; no big-game safari within reach.',
  island: 'An island with no big-game safari parks.',
  coastal_area: 'A coastal destination with no big-game safari parks nearby.',
  national_park: 'Not a game-drive safari destination; its wildlife is covered by Wildlife Viewing.',
  wilderness_area: 'Not a game-drive safari destination; its wildlife is covered by Wildlife Viewing.',
  region: 'Not a game-drive safari destination; its wildlife is covered by Wildlife Viewing.',
  state_province: 'Not a game-drive safari destination; its wildlife is covered by Wildlife Viewing.',
  country: 'No classic game-drive safari here; its wildlife is covered by Wildlife Viewing.',
};
const SPECIFIC: Record<string, Record<string, string>> = { diving: { chicago: 'A Great Lakes city; the only diving is cold freshwater wreck diving, not a draw for most visitors.' } };

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const rows = await db.select().from(places);
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  const touched = new Map<string, Record<string, unknown>>();
  const add = (r: (typeof rows)[number], key: string, reason: string) => {
    const have = (touched.get(r.id) ?? (r.naReasons as Record<string, unknown>) ?? {});
    if ((have as any)[key]?.reason) return false;
    touched.set(r.id, { ...have, [key]: { reason, source: 'manual', by: 'Claude (draft, 21 Oct 2026)', at: new Date().toISOString() } });
    return true;
  };
  let safari = 0, diving = 0, unknownType = 0;
  for (const r of rows) {
    if (r.naSliders.includes('safari') && !(r.naReasons as any)?.safari?.reason) {
      const text = SAFARI_BY_TYPE[String(r.placeType)];
      if (!text) { unknownType++; console.log('no template for', r.name, r.placeType); continue; }
      if (add(r, 'safari', text)) safari++;
    }
    const d = SPECIFIC.diving[r.id];
    if (d && r.naSliders.includes('diving') && add(r, 'diving', d)) diving++;
  }
  for (const r of rows) { const v = touched.get(r.id); if (v) patches.push({ entityType: 'destination', entityId: r.id, field: 'naReasons', value: v, loadedUpdatedAt: r.updatedAt.toISOString() }); }
  console.log(`safari ${safari}, diving ${diving}, no template ${unknownType}; ${patches.length} places`);
  if (!apply) { console.log('dry run'); process.exit(0); }
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  let saved = 0;
  for (let i = 0; i < patches.length; i += 25) {
    const res = await applyAdminEdits(patches.slice(i, i + 25), CLAUDE_ACTOR);
    saved += res.saved.length;
    if (res.errors.length || res.conflicts.length) console.log('PROBLEM', JSON.stringify(res.errors), JSON.stringify(res.conflicts));
  }
  console.log('saved', saved);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
