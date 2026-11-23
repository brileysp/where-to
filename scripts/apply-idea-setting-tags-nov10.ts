// 10 Nov 2026: gives every future-place idea its setting tags (what the place is like, 1 to 4, first primary), replacing the old birding-ranking place type.
// Tags were assigned by hand from each idea's name, region and note (scripts/data/idea-setting-tags-nov10.json); an idea that appears under several interests
// (Sumatra, Dominica...) carries the same tags everywhere. Only fills ideas that have no tags yet. Dry run unless --apply.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/apply-idea-setting-tags-nov10.ts [--apply]
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client'); const { interestPlaceIdeas } = await import('../src/lib/db/schema'); const { eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write'); const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth'); const { SETTING_TAG_SLUGS } = await import('../src/lib/places/setting-tags');
  const tags = JSON.parse(readFileSync(join(__dirname, 'data', 'idea-setting-tags-nov10.json'), 'utf8')) as Record<string, string[]>;
  const rows = await db.select().from(interestPlaceIdeas); let n = 0, bad = 0;
  for (const r of rows) {
    const t = tags[r.id]; if (!t) { console.log('no tags for', r.name); continue; }
    if (t.length < 1 || t.length > 4 || t.some((x) => !(SETTING_TAG_SLUGS as readonly string[]).includes(x))) { bad++; console.log('bad tags', r.name, t); continue; }
    if (r.settingTags.length) continue; n++;
    if (apply) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_place_idea', entityId: r.id, action: 'update', before: r, after: { ...r, settingTags: t }, write: (tx) => tx.update(interestPlaceIdeas).set({ settingTags: t, updatedAt: new Date() }).where(eq(interestPlaceIdeas.id, r.id)).returning() });
  }
  console.log(`${apply ? 'tagged' : 'would tag'} ${n} ideas; ${bad} bad`); process.exit(0);
})();
