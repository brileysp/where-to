// Seeds the Surfing admin page columns (11 Oct 2026). Safe to re-run: it only fills cells that are still empty, so nothing typed
// on the admin page is ever overwritten. Every row keeps drawSourceChecked = false until a place has been fully checked.
// Also logs one review per place that was checked against the web (SURF_CHECKED) and two to-dos.
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-surfing-facts.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';

for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
}

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places, placeInterestFacts, interestReviews, interestTodos } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { SURF_DRAFT, SURF_VERIFIED, SURF_CHECKED } = await import('./data/surfing-facts-draft');
  const { factDefsFor } = await import('../src/lib/admin/interest-pages/config');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');

  const defs = factDefsFor('surfing');
  const choiceOk = (key: string, v: string) => defs.find((d) => d.key === key)?.options?.some((o) => o.value === v) ?? false;
  const rows = await db.select({ id: places.id, name: places.name, na: places.naSliders }).from(places);
  const live = new Map(rows.filter((r) => !(r.na as string[]).includes('surfing')).map((r) => [r.id, r.name]));
  const known = new Set(rows.map((r) => r.id));

  const merged: Record<string, Record<string, unknown>> = {};
  for (const src of [SURF_DRAFT, SURF_VERIFIED]) {
    for (const [id, d] of Object.entries(src)) {
      merged[id] = { ...(merged[id] ?? {}), ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)) };
    }
  }
  const MAP: Record<string, string> = { br: 'breaks', wt: 'waveType', b: 'beginnerRating', a: 'advancedRating', hz: 'hazards', sz: 'waveSize', tp: 'waterTemp', cr: 'crowds', cn: 'consistency' };

  let cells = 0;
  let touched = 0;
  const problems: string[] = [];
  for (const [id, d] of Object.entries(merged)) {
    if (!known.has(id)) { problems.push(`unknown place id ${id}`); continue; }
    if (!live.has(id)) problems.push(`${id} is N/A for surfing`);
    const facts: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(d)) {
      const key = MAP[k];
      if (['wt', 'cr', 'cn'].includes(k) && !choiceOk(key, v as string)) { problems.push(`${id}: bad ${key} "${v}"`); continue; }
      facts[key] = v as string | number;
    }
    facts.drawSourceChecked = false;
    const [existing] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, id), eq(placeInterestFacts.interestKey, 'surfing')));
    const have = (existing?.facts ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...have };
    let added = 0;
    for (const [k, v] of Object.entries(facts)) if (have[k] === undefined || have[k] === null || have[k] === '') { next[k] = v; added++; }
    if (!added) continue;
    cells += added; touched++;
    if (apply) await db.insert(placeInterestFacts).values({ placeId: id, interestKey: 'surfing', facts: next as never }).onConflictDoUpdate({ target: [placeInterestFacts.placeId, placeInterestFacts.interestKey], set: { facts: next as never, updatedAt: new Date() } });
  }

  // Reviews for the places checked against the web.
  const existingReviews = await db.select().from(interestReviews).where(eq(interestReviews.interestKey, 'surfing'));
  const reviewed = new Set(existingReviews.filter((r) => r.reviewerName === 'Claude (web source check)').map((r) => r.placeId));
  let reviewsNew = 0;
  for (const [id, c] of Object.entries(SURF_CHECKED)) {
    if (!known.has(id)) { problems.push(`review: unknown place ${id}`); continue; }
    if (reviewed.has(id)) continue;
    const notes = `Checked: ${c.covered}. What changed in the columns: ${c.changed} Sources: ${c.urls.join('  ')}`;
    reviewsNew++;
    if (apply) {
      const values = { interestKey: 'surfing', placeId: id, reviewerName: 'Claude (web source check)', reviewerRole: 'AI: Claude', reviewedOn: '2026-10-11', notes, createdBy: CLAUDE_ACTOR.email };
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: 'surfing:new', action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
    }
  }

  const unfilled = [...live.keys()].filter((id) => !merged[id]);
  console.log(`${apply ? 'wrote' : 'would write'} ${cells} cells on ${touched} places; ${reviewsNew} reviews; ${Object.keys(merged).length} places drafted; ${unfilled.length} applicable places still empty`);
  if (problems.length) console.log('PROBLEMS:\n ' + problems.join('\n '));
  if (apply) {
    const have = new Set((await db.select().from(interestTodos).where(eq(interestTodos.interestKey, 'surfing'))).map((t) => t.title));
    const todos = [
      { title: `Fill the surfing columns for the ${unfilled.length} places still empty`, detail: `Drafted so far: ${Object.keys(merged).length} places. Still empty: ${unfilled.map((id) => live.get(id)).join(', ')}.`, status: 'ready_for_claude' as const },
      { title: 'Source-check the surfing columns for the places not yet checked against the web', detail: `Checked against the web on 11 Oct 2026: ${Object.keys(SURF_CHECKED).map((id) => live.get(id) ?? id).join(', ')}. Every other drafted place is from general knowledge and unchecked. Source-checked stays No until all of a place's entries are confirmed.`, status: 'ready_for_claude' as const },
      { title: 'Surf scores that disagree with the new ratings', detail: 'Namibia (Skeleton Bay, advanced rating 9.5, but a score peak of 2.9) and French Polynesia (Teahupo\'o, advanced rating 9.5, but a score peak of 5.0) look too low for their waves. Decide whether to raise them in the surfing rewrite.', status: 'needs_you' as const },
    ];
    for (const t of todos) if (!have.has(t.title)) await db.insert(interestTodos).values({ interestKey: 'surfing', source: 'Surfing columns build, 11 Oct 2026', ...t });
  }
  process.exit(0);
})();
