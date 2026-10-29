// 26 Oct 2026: owner approved adding Orlando and Southern California to the Theme Parks future places (the interest's two obvious flagships were missing).
// Attendance figures are the TEA/AECOM 2024 ranking as listed on Wikipedia. Southern California is already on the surfing list under the same name, so both
// entries get an "Also on" note. Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-theme-parks-future-places-oct26.ts [--apply]
import { readFileSync } from 'fs';
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const t = l.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const ITEMS = [
  { name: 'Orlando', region: 'Florida, USA', nearestExisting: 'Everglades National Park', placeType: 'North America', grain: 0, grainNote: 'One metro area, one decision.', sortOrder: 1,
    why: 'The theme park capital of the world. Magic Kingdom is the most visited park on Earth (17.8 million in 2024), with Epcot (12.1 million), Hollywood Studios (10.3 million) and Animal Kingdom (8.8 million) beside it, plus Universal Studios Florida (9.5 million), Islands of Adventure (9.5 million), Volcano Bay (joint seventh among the world\'s water parks by attendance) and SeaWorld.  (Established. Attendance: TEA/AECOM 2024 ranking.)' },
  { name: 'Southern California', region: 'California, USA', nearestExisting: 'Palm Springs & Joshua Tree', placeType: 'North America', grain: 1, grainNote: 'A region: Anaheim, Los Angeles and San Diego are separate bases.', sortOrder: 2,
    why: 'Disneyland (17.3 million in 2024, the second most visited park in the world) and Disney California Adventure (10 million) in Anaheim, Universal Studios Hollywood (8.7 million), Knott\'s Berry Farm, Six Flags Magic Mountain, LEGOLAND California and, in San Diego, SeaWorld and the San Diego Zoo. (Established. Attendance: TEA/AECOM 2024 ranking.)' },
];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestPlaceIdeas } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const all = (await db.select().from(interestPlaceIdeas)) as any[];
  for (const it of ITEMS) {
    if (all.some((i) => i.interestKey === 'themeParks' && i.name === it.name)) { console.log(it.name, 'already there'); continue; }
    const other = all.find((i) => i.interestKey !== 'themeParks' && i.name.toLowerCase() === it.name.toLowerCase());
    const why = other ? `${it.why} ↳ Also on the surfing list (same name).` : it.why;
    console.log(`${apply ? 'adding' : 'would add'} ${it.name}${other ? ' (also on the ' + other.interestKey + ' list)' : ''}`);
    if (!apply) continue;
    const values = { interestKey: 'themeParks', ...it, why, stage: 'idea' as const };
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_place_idea', entityId: 'themeParks:new', action: 'create', before: null, after: values, write: (tx: any) => tx.insert(interestPlaceIdeas).values(values).returning() });
    if (other && !other.why.includes('theme parks list')) {
      const w = `${other.why} ↳ Also on the theme parks list (same name).`;
      await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_place_idea', entityId: other.id, action: 'update', before: other, after: { ...other, why: w }, write: (tx: any) => tx.update(interestPlaceIdeas).set({ why: w, updatedAt: new Date() }).where(eq(interestPlaceIdeas.id, other.id)).returning() });
    }
  }
  process.exit(0);
})();
