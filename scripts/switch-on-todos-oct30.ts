// 30 Oct 2026: to-dos for the columns that could not be filled from data when the 43 place-interest pairs were switched on (see scripts/switch-on-oct30.ts).
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/switch-on-todos-oct30.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const TODOS = [
  { interestKey: 'hotSprings', title: 'Fill the Hot Springs columns for the 9 places switched on 30 Oct', detail: 'Bali, Bavaria & Munich, Malaysian Borneo, Chiang Mai, Guatemala, Istanbul, Napa & Sonoma, Okinawa and Vietnam have a score and a month curve (judged, source page recorded on each place) but none of the 11 columns, which need hand research. No authoring directive exists for Hot Springs, so there is no overview text either.' },
  { interestKey: 'mountaineering', title: 'Fill the Mountaineering columns for the 6 places switched on 30 Oct', detail: 'Colombian Andes, Costa Rica, Guatemala, Mongolia, Nice & the French Riviera and Yellowstone have a score and a month curve (judged, source page recorded) but none of the 15 columns, which need hand research (levels, guide rules, permits, planning ahead).' },
  { interestKey: 'skiingSnowboarding', title: 'Fill the Skiing columns for Taiwan (switched on 30 Oct)', detail: 'Taiwan has a score of 2 and a month curve (Hehuanshan, the only small ski slope) but none of the 8 columns.' },
  { interestKey: 'kayakingRafting', title: 'Research whitewater for Tokyo & Kyoto and Rajasthan (switched on 30 Oct)', detail: 'Calm-water, sea kayaking, water temperature and skill levels are filled from map and weather data. Whitewater rating, classes, multi-day trips and guide rules are blank: the Hozugawa and Tama rivers (Tokyo & Kyoto) and the Chambal (Rajasthan) need the hand search used for the other 67 places.' },
  { interestKey: 'geologyVolcanoes', title: 'Add overview text for the places switched on 30 Oct (no authoring directive yet)', detail: 'Eleven Geology places (Antarctic Peninsula, Basque Country, Bavaria, Borneo, Chamonix, Colombian Andes, Galápagos, Ireland, Nepal, Papua New Guinea, Swiss Alps) show "No text yet", like every Geology place. The same is true of the golf, mountain-biking, sailing and kayaking cells switched on that day: none of those interests has a Gemini authoring directive.' },
];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestTodos } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  let made = 0;
  for (const t of TODOS) {
    const [ex] = await db.select({ id: interestTodos.id }).from(interestTodos).where(and(eq(interestTodos.interestKey, t.interestKey), eq(interestTodos.title, t.title)));
    if (ex) continue;
    const values = { interestKey: t.interestKey, title: t.title, detail: t.detail, status: 'idea' as const, source: 'Switch-on, 30 Oct 2026', priority: 2 };
    made++;
    if (apply) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${t.interestKey}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
  }
  console.log(`${apply ? 'created' : 'would create'} ${made} to-dos`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
