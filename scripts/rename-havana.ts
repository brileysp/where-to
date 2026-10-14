import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Broadens seven places in name, region and short blurbs only. Ids, scores, months and interest texts are untouched.
const CHANGES: Record<string, { name: string; region?: string; overview: string; about?: string; addAliases: string[] }> = {
  havana: {
    name: 'Cuba',
    overview: '1950s American cars and crumbling Spanish-colonial Havana, the tobacco farms and limestone hills of Viñales, cobbled Trinidad, and white-sand cayes off the north coast.',
    addAliases: ['Havana', 'Viñales', 'Trinidad', 'Varadero', 'Cayo Coco', 'Jardines de la Reina'],
  },
};

(async () => {
  const { db } = await import('../src/lib/db/client');
  const { places } = await import('../src/lib/db/schema');
  const { inArray } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const ids = Object.keys(CHANGES);
  const rows = await db.select().from(places).where(inArray(places.id, ids));
  const patches: Array<{ entityType: string; entityId: string; field: string; value: unknown; loadedUpdatedAt: string }> = [];
  for (const r of rows) {
    const c = CHANGES[r.id];
    const base = { entityType: 'destination', entityId: r.id, loadedUpdatedAt: r.updatedAt.toISOString() };
    patches.push({ ...base, field: 'name', value: c.name });
    if (c.region) patches.push({ ...base, field: 'region', value: c.region });
    patches.push({ ...base, field: 'overview', value: c.overview });
    if (c.about) patches.push({ ...base, field: 'about', value: c.about });
    const aliases = [...r.searchAliases];
    for (const a of c.addAliases) if (!aliases.some((x) => x.toLowerCase() === a.toLowerCase())) aliases.push(a);
    if (aliases.length !== r.searchAliases.length) patches.push({ ...base, field: 'searchAliases', value: aliases });
  }
  const res = await applyAdminEdits(patches, CLAUDE_ACTOR);
  console.log('saved', res.saved.length, 'conflicts', res.conflicts.length, 'errors', JSON.stringify(res.errors));
  process.exit(0);
})();
