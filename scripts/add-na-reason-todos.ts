// Adds one to-do per interest whose N/A places have no stored reason yet (owner request, 12 Oct 2026). Skips the hidden interests.
// Safe to re-run: an interest that already has the to-do (open) is skipped; the count in the title is not part of the match.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/add-na-reason-todos.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { places, interestTodos } = await import('../src/lib/db/schema');
  const { SLIDERS } = await import('../src/lib/scoring/constants');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const rows = await db.select({ name: places.name, na: places.naSliders, reasons: places.naReasons, primary: places.isPrimaryDestination }).from(places);
  const existing = await db.select().from(interestTodos);
  const today = new Date().toISOString().slice(0, 10);
  let made = 0, skipped = 0;
  for (const s of SLIDERS.filter((x) => !x.hidden)) {
    const missing = rows.filter((p) => p.primary && (p.na as string[]).includes(s.key) && !(p.reasons as Record<string, unknown>)[s.key]).map((p) => p.name).sort();
    if (!missing.length) continue;
    if (existing.some((t) => t.interestKey === s.key && t.status !== 'done' && t.title.startsWith('Add N/A reasons'))) { skipped++; continue; }
    const list = missing.length <= 25 ? ` Places: ${missing.join(', ')}.` : ' Filter the Places & data tab to N/A to see them.';
    const values = {
      interestKey: s.key,
      title: `Add N/A reasons for the ${missing.length} places marked N/A`,
      detail: `${missing.length} places are marked N/A for ${s.label} but have no reason stored. Write a one-line reason for each (why the interest does not apply there), or, where the N/A flag looks wrong, say so so it can be reviewed. The reasons show in the chip on the Places & data tab.${list}`,
      status: 'ready_for_claude' as const,
      source: `N/A reason check, ${today}`,
    };
    made++;
    if (apply) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${s.key}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
  }
  console.log(`${apply ? 'created' : 'would create'} ${made} to-dos; ${skipped} interests already had one`);
  process.exit(0);
})();
