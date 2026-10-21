// 20 Oct 2026 (owner decision): Spectator Sports is folded into Festivals and stops existing as an interest.
//   - Festivals gets its first data column, "Sporting events", filled from the 23 Spectator Sports place scores; its "Sporting events" chip reads it.
//   - The 2 Spectator Sports timed events (Wimbledon, US Open) become Festivals events.
//   - The spectatorSports key is stripped from every place (scores, curves, status, signature tier, events) and from 20 saved preference rows
//     (the weight is folded into Festivals as the larger of the two). The settings row is deleted. The audit log history is left alone.
//   - A backup of everything removed is written to docs/backups first.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/fold-spectator-sports-oct20.ts [--apply]
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const K = 'spectatorSports';
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { sql, and, eq } = await import('drizzle-orm');
  const { placeInterestFacts, interestChips, interestMeta } = await import('../src/lib/db/schema');
  const rows: any = await db.execute(sql`select id, name, base_scores->${K} as score, slider_curves->${K} as curve, score_status->${K} as status, signature_tier->${K} as tier, slider_events->${K} as events, slider_events->'festivals' as fest_events from places where base_scores ? ${K} or slider_curves ? ${K} or score_status ? ${K} or signature_tier ? ${K} or slider_events ? ${K}`);
  const places = (rows.rows ?? rows) as any[];
  const prefsRes: any = await db.execute(sql`select user_id, (weights->${K})::float as sw, (weights->'festivals')::float as fw from user_preferences where weights ? ${K}`);
  const prefs = (prefsRes.rows ?? prefsRes) as any[];
  const scored = places.filter((p) => p.score !== null);
  const evs = places.filter((p) => Array.isArray(p.events) && p.events.length);
  console.log(`places touched ${places.length} (scored ${scored.length}, with events ${evs.length}); saved preference rows ${prefs.length}`);
  const backup = { note: 'Removed on 20 Oct 2026 when Spectator Sports was folded into Festivals. Restore by writing each value back under the spectatorSports key.', places, prefs };
  if (!apply) { console.log('dry run: pass --apply to write'); process.exit(0); }
  writeFileSync(join(__dirname, '..', 'docs', 'backups', 'spectator-sports-removed-2026-10-20.json'), JSON.stringify(backup, null, 1));
  await db.transaction(async (tx) => {
    for (const p of scored) {
      const v = Math.round(Math.max(0, Math.min(10, Number(p.score))) * 10) / 10;
      const ex = await tx.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, p.id), eq(placeInterestFacts.interestKey, 'festivals')));
      const facts = { ...((ex[0]?.facts as Record<string, unknown>) ?? {}) };
      if (facts.sportingEvents === undefined || facts.sportingEvents === null) facts.sportingEvents = v;
      await tx.insert(placeInterestFacts).values({ placeId: p.id, interestKey: 'festivals', facts: facts as never, updatedAt: new Date() }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: facts as never, updatedAt: new Date() } });
    }
    for (const p of evs) {
      const have: any[] = Array.isArray(p.fest_events) ? p.fest_events : [];
      const add = (p.events as any[]).filter((e) => !have.some((h) => h.label === e.label));
      if (add.length) await tx.execute(sql`update places set slider_events = jsonb_set(slider_events, '{festivals}', ${JSON.stringify([...have, ...add])}::jsonb, true) where id = ${p.id}`);
    }
    await tx.update(interestChips).set({ drivers: [{ column: 'sportingEvents' }], needsColumn: '', updatedBy: 'Claude (column added, 20 Oct 2026)', updatedAt: new Date() }).where(and(eq(interestChips.interestKey, 'festivals'), eq(interestChips.chipKey, 'sporting-events')));
    await tx.execute(sql`update places set base_scores = base_scores - ${K}, slider_curves = slider_curves - ${K}, score_status = score_status - ${K}, signature_tier = signature_tier - ${K}, slider_events = slider_events - ${K} where base_scores ? ${K} or slider_curves ? ${K} or score_status ? ${K} or signature_tier ? ${K} or slider_events ? ${K}`);
    for (const r of prefs) {
      const w = Math.max(Number(r.sw ?? 0), Number(r.fw ?? 0));
      await tx.execute(sql`update user_preferences set weights = (weights - ${K}) || jsonb_build_object('festivals', ${w}::numeric) where user_id = ${r.user_id}`);
    }
    await tx.delete(interestMeta).where(eq(interestMeta.key, K));
  });
  const left: any = await db.execute(sql`select (select count(*) from places where base_scores ? ${K} or slider_curves ? ${K} or score_status ? ${K} or signature_tier ? ${K} or slider_events ? ${K}) places_left, (select count(*) from user_preferences where weights ? ${K}) prefs_left, (select count(*) from place_interest_facts where interest_key='festivals') festival_cells`);
  console.log('after:', JSON.stringify((left.rows ?? left)[0]));
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
