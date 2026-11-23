// 29 Oct 2026: logs the four planning scores (seasonal variance, evergreen, stakes, refresh effort) and their reasons on interest_meta for every interest.
// Seasonal variance and evergreen were approved by the owner in the "Planning scores proposal" artifact (question 8, 29 Oct 2026); stakes and refresh effort are
// proposed and stay unapproved until the owner says so. Fills empty scores only, so anything the owner edited in the admin is never overwritten.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-interest-planning.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type Row = { seasonalVariance: number; evergreen: number; stakes: number; refreshEffort: number; notes: Record<string, string> };
(async () => {
  const apply = process.argv.includes('--apply');
  const data = JSON.parse(readFileSync(join(__dirname, 'data', 'interest-planning.json'), 'utf8')) as Record<string, Row>;
  const { db } = await import('../src/lib/db/client');
  const { interestMeta } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { SLIDERS } = await import('../src/lib/scoring/constants');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { PLANNING_KEYS } = await import('../src/lib/scoring/planning');
  const today = new Date().toISOString().slice(0, 10);
  const owner = { by: 'Owner (brileysp@gmail.com)', at: today, via: 'Planning scores proposal artifact, question 8' };
  let touched = 0, cells = 0;
  const problems: string[] = [];
  for (const [key, row] of Object.entries(data)) {
    if (!SLIDERS.some((s) => s.key === key)) { problems.push(`unknown interest ${key}`); continue; }
    const [existing] = await db.select().from(interestMeta).where(eq(interestMeta.key, key));
    const set: Record<string, unknown> = {};
    for (const k of PLANNING_KEYS) if (existing?.[k] == null) { set[k] = row[k]; cells++; }
    if (!Object.keys(set).length) continue;
    const old = (existing?.planningNotes ?? {}) as Record<string, unknown>;
    const approved = { ...((old.approved as object) ?? {}) } as Record<string, unknown>;
    if ('seasonalVariance' in set) approved.seasonalVariance = owner;
    if ('evergreen' in set) approved.evergreen = owner;
    set.planningNotes = { ...row.notes, ...old, approved, proposedBy: 'Claude, 29 Oct 2026' };
    set.updatedAt = new Date();
    touched++;
    if (!apply) continue;
    if (existing) {
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest', entityId: key, action: 'update', before: existing, after: { ...existing, ...set }, write: (tx) => tx.update(interestMeta).set(set as never).where(eq(interestMeta.key, key)).returning() });
    } else {
      const values = { key, ...set };
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest', entityId: key, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestMeta).values(values as never).returning() });
    }
  }
  console.log(`${apply ? 'wrote' : 'would write'} ${cells} scores on ${touched} interests`);
  if (problems.length) console.log('PROBLEMS: ' + problems.join('; '));
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
