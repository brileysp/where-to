// 23 Oct 2026: to-dos from the owner's review-queue comments. Safe to re-run: skips what already exists.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/review-todos-oct23.ts
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
(async () => {
  const { db } = await import('../src/lib/db/client');
  const { interestTodos } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const todos: Array<{ key: string; title: string; detail: string }> = [
    { key: 'beachesSwimming', title: 'Research water temperature for each month and show the warmest and coldest months', detail: 'Owner (23 Oct 2026): the single "sea temperature in beach season" column is not enough. Research the typical water temperature for every month at each beach place, then store the warmest and coldest temperatures with the months they fall in, and check the seasonal beach curves against them. The temperate re-score used rough coldest/warmest figures per place (table in scripts/rescore-temperate-beaches-oct22.ts) that should be replaced by sourced ones.' },
    { key: 'beachesSwimming', title: 'Fix the beach score mismatches the columns reveal (Andalucía, Bordeaux, Marrakech & Atlas)', detail: 'Owner could not find these on the page, so this is kept as a to-do. Andalucía (peak 2.0), Bordeaux (2.4) and Marrakech & Atlas disagree with their beach columns: the Costa del Sol and Cádiz coast and the Atlantic coast near Bordeaux have good beaches, while Marrakech is inland. Re-author the score where the columns say it is wrong.' },
    { key: 'beachesSwimming', title: 'Check every beach destination reaches about 9 at its best and has a real off-season', detail: 'Owner (23 Oct 2026): a place people go to for the beaches should score about 9 at its best, and the off-season should reflect walks, ball games and dogs on the beach, not only swimming. Pass 2 of the temperate re-score (23 Oct) raised nine places and lifted the off-season floors; look over the rest of the 54, and the tropical places left alone, with that rule.' },
    { key: 'mountaineering', title: 'Re-check the alpine and trekking-peak ratings against what you think of each place', detail: 'Owner (23 Oct 2026) found the ratings stingy. Raised: Denali 8 to 10, Peru 6 to 9, Ecuadorian Andes 7 to 8, Swiss Alps 9 to 10, Banff 6 to 7. Kilimanjaro stays 5 on alpine climbing (and 10 on non-technical summits). Read the rest of the Alpine and Non-technical summits columns once more.' },
    { key: '_site', title: 'Re-author crowd and price tiers from sources, not judgment', detail: 'Owner (23 Oct 2026): extreme crowds in Finnish Lapland, Northern Tanzania, Monterey & Big Sur, Oaxaca, Hokkaido and Torres del Paine look wrong, and Antarctica cruise prices do not swing wildly by season. Plan: prices from a uniform source (monthly average hotel rates, peak month against cheapest month, with safari and cruise rate cards where those are the market), crowds from visitor statistics where published, each tier stored with its evidence and marked estimated where no figures exist. Method and pilot on the seven disputed places: review artifact.' },
  ];
  let made = 0;
  for (const t of todos) {
    const [ex] = await db.select({ id: interestTodos.id }).from(interestTodos).where(and(eq(interestTodos.interestKey, t.key), eq(interestTodos.title, t.title)));
    if (ex) continue;
    const values = { interestKey: t.key, title: t.title, detail: t.detail, status: 'idea' as const, source: 'Review queue, 23 Oct 2026', doneAt: null };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${t.key}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
    made++;
  }
  console.log('to-dos added', made);
  process.exit(0);
})();
