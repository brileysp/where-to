import { readFileSync } from 'fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Logs a whale-watching source check (Oct 2026): fixes the column cells the sources contradict, marks the entries
// source-checked, saves the sources on the place and adds a dated review entry. It never touches the live text:
// text problems are listed for the owner. Input: a JSON file { placeId: { verdict, notes, sources[], colFix{} } }.
// Usage: npx tsx scripts/apply-whale-check.ts path/to/whale_check.json
type Check = { verdict: string; notes: string; sources: Array<{ url: string; label?: string; note?: string }>; colFix: Record<string, string>; proposal: { note?: string } | null };
(async () => {
  const checks = JSON.parse(readFileSync(process.argv[2], 'utf8')) as Record<string, Check>;
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, places, interestReviews } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { applyAdminEdits } = await import('../src/lib/admin/apply-edits');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const today = new Date().toISOString().slice(0, 10);
  const existingReviews = await db.select().from(interestReviews).where(eq(interestReviews.interestKey, 'whaleWatching'));
  let fixed = 0, flagged = 0, logged = 0;
  for (const [placeId, c] of Object.entries(checks)) {
    const [p] = await db.select().from(places).where(eq(places.id, placeId));
    if (!p) { console.log('unknown place', placeId); continue; }
    // 1. columns
    const [row] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, placeId), eq(placeInterestFacts.interestKey, 'whaleWatching')));
    const facts = { ...((row?.facts as Record<string, unknown>) ?? {}) };
    for (const [k, v] of Object.entries(c.colFix)) { facts[k] = v; fixed++; }
    facts.drawSourceChecked = true;
    await db.insert(placeInterestFacts).values({ placeId, interestKey: 'whaleWatching', facts: facts as never })
      .onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: facts as never, updatedAt: new Date() } });
    // 2. sources saved on the place
    const have = ((p.sliderSources as Record<string, Array<{ url: string }>>) ?? {}).whaleWatching ?? [];
    const add = c.sources.filter((s) => !have.some((h) => h.url === s.url)).map((s) => ({ ...s, addedAt: today }));
    if (add.length) {
      const all = { ...(p.sliderSources as Record<string, unknown>), whaleWatching: [...have, ...add] };
      const res = await applyAdminEdits([{ entityType: 'destination', entityId: placeId, field: 'sliderSources', value: all, loadedUpdatedAt: p.updatedAt.toISOString() }], CLAUDE_ACTOR);
      if (res.errors.length || res.conflicts.length) console.log('sources not saved for', placeId, JSON.stringify(res.errors), res.conflicts.length);
    }
    // 3. a dated review entry (once per place per day)
    if (!existingReviews.some((r) => r.placeId === placeId && r.reviewedOn === today && r.reviewerName.startsWith('Claude'))) {
      const note = `${{ confirmed: 'Confirmed', 'partly confirmed': 'Partly confirmed', partly: 'Partly confirmed', corrected: 'Corrected', unverified: 'Not verified' }[c.verdict] ?? c.verdict}. ${c.notes}${c.proposal?.note ? ' Suggested text change (not applied): ' + c.proposal.note : ''}`;
      const values = { interestKey: 'whaleWatching', placeId, reviewerName: 'Claude (web source check)', reviewerRole: 'AI: Claude', reviewedOn: today, notes: note, createdBy: CLAUDE_ACTOR.email };
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: 'whaleWatching:new', action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
      logged++;
    }
    if (c.proposal) flagged++;
  }
  console.log(`places ${Object.keys(checks).length}, column cells fixed ${fixed}, reviews logged ${logged}, with a suggested text change ${flagged}`);
  process.exit(0);
})();
