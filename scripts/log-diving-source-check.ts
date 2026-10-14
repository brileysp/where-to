import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Logs the Oct 2026 diving source check (docs/diving-source-check.json) as one review per place on the
 * Snorkeling & Diving interest page. Notes are shown in Fahrenheit and feet like the rest of the app.
 * Run with --apply to write; without it, prints what would be written.
 */
for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = l.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
}

const REVIEWED_ON = '2026-10-10';
const VERDICT_WORD: Record<string, string> = { confirmed: 'Confirmed', partly: 'Partly confirmed', corrected: 'Corrected' };

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestReviews, places } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const { convertTemperaturesToF } = await import('../src/lib/text/temperature');
  const { convertMetersToFeet } = await import('../src/lib/text/length');

  const ledger = JSON.parse(readFileSync(join(__dirname, '..', 'docs', 'diving-source-check.json'), 'utf8')).places as Record<
    string,
    { verdict: string; notes: string; sources?: string[] }
  >;
  const rows = await db.select({ id: places.id, name: places.name }).from(places);
  const idByName = new Map(rows.map((r) => [r.name, r.id]));
  const existing = await db.select().from(interestReviews).where(eq(interestReviews.interestKey, 'diving'));
  const done = new Set(existing.filter((r) => r.reviewerName === 'Claude (web source check)').map((r) => r.placeId));

  let written = 0;
  const missing: string[] = [];
  for (const [name, e] of Object.entries(ledger)) {
    const id = idByName.get(name);
    if (!id) { missing.push(name); continue; }
    if (done.has(id)) continue;
    const word = VERDICT_WORD[e.verdict];
    if (!word) continue; // "not verified" entries are not a check
    const sources = (e.sources ?? []).slice(0, 4).join('  ');
    const notes = convertMetersToFeet(convertTemperaturesToF(`${word}. ${e.notes}${sources ? ` Sources: ${sources}` : ''}`)).replace(/\bcentre/gi, (m) => (m[0] === 'C' ? 'Center' : 'center'));
    const values = { interestKey: 'diving', placeId: id, reviewerName: 'Claude (web source check)', reviewerRole: 'AI: Claude', reviewedOn: REVIEWED_ON, notes, createdBy: CLAUDE_ACTOR.email };
    written++;
    if (apply) {
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: 'diving:new', action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
    } else if (written <= 3) console.log(id, '\n ', notes.slice(0, 500), '\n');
  }
  console.log(`${apply ? 'logged' : 'would log'} ${written}; no place matched for: ${missing.join(', ') || 'none'}; already logged: ${done.size}`);
  process.exit(0);
})();
