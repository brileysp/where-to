// 31 Oct 2026: to-dos for the cells switched on when Cambodia and Kaziranga (Assam & Northeast India) got whole-region outlines. Usage: npx tsx scripts/outline-todos-oct31.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const TODOS = [
  { interestKey: 'mountaineering', title: 'Fill the Mountaineering columns and text for Assam & Northeast India (switched on 31 Oct)', detail: 'Switched on after the place got a whole-Northeast outline (224 peaks above 3,000 m, Kanchenjunga on the Sikkim border). It has a score of 3.5 and a month curve (sources recorded) but none of the 15 columns and no text. Permits and peak royalties (Sikkim, Arunachal) need hand research.' },
  { interestKey: 'kayakingRafting', title: 'Research whitewater for Cambodia (switched on 31 Oct)', detail: 'Cambodia is switched on for Kayaking & Rafting at 4.5 with a month curve (Kampot river, Tonle Sap flooded forest, Koh Kong). Calm-water, sea kayaking, water temperature and skill levels are filled from map and weather data; whitewater, classes, multi-day trips and guide rules are blank (no commercial whitewater was found, none searched). Check the Tonle Sap flooded-forest paddling months (about August to December) against the curve.' },
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
    const values = { interestKey: t.interestKey, title: t.title, detail: t.detail, status: 'idea' as const, source: 'Outlines, 31 Oct 2026', priority: 2 };
    made++;
    if (apply) await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_todo', entityId: `${t.interestKey}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestTodos).values(values).returning() });
  }
  console.log(`${apply ? 'created' : 'would create'} ${made} to-dos`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
