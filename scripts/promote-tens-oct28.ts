// 28 Oct 2026: the owner asked for "a handful" of 10s in every scored column (places among the few best in the world for that thing).
// Judgement ratings below are raised to 10 where the column's own hint names the place or the place is a recognised world benchmark; reasons are in PROMOTIONS.
// Formula-driven columns (regattas, expedition sailing, sea kayaking, bikepacking, e-bike rental, lift-served parks) are changed in their own scripts.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/promote-tens-oct28.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
const PROMOTIONS: Array<[string, string, string[], string]> = [
  ['auroraChasing', 'auroraStrength', ['churchill', 'denali-interior'], "The column's own anchor: 10 is Fairbanks and Churchill."],
  ['beachesSwimming', 'urbanSwimming', ['copenhagen', 'sydney', 'barcelona', 'bavaria-munich'], 'Cities whose summer is built around the water: harbor baths, the city beaches, the Isar and the lakes.'],
  ['festivals', 'sportingEvents', ['london', 'nyc', 'paris'], 'World sporting capitals (grand slams, Olympics, top league seasons).'],
  ['historyArchaeology', 'prehistoricSites', ['ireland'], 'Newgrange and the Boyne Valley, a world-class concentration; the only such place in the list.'],
  ['historyArchaeology', 'warHistory', ['berlin'], "The column's own anchor: visited mainly for it (Berlin)."],
  ['hotSprings', 'naturalPools', ['iceland', 'chilean-lake-district', 'hokkaido'], "The column's own examples: Iceland's river and lagoon pools, Chile's Termas Geometricas, Japanese rotenburo."],
  ['luxuryHotels', 'boutiqueHotels', ['paris', 'tokyo-kyoto', 'lisbon'], "The column's own anchor: boutique-hotel capitals Paris, Lisbon and Tokyo."],
  ['museumsArt', 'quirkyMuseums', ['london', 'berlin', 'tokyo-kyoto'], 'The cities with the deepest scene of small, specialist and unusual museums.'],
  ['religiousSites', 'pilgrimageRoutes', ['rioja', 'srilanka'], "Rioja is on the Camino de Santiago (Camino Frances), the benchmark pilgrimage route; Sri Lanka has Adam's Peak, climbed by pilgrims through the night every season."],
  ['safari', 'closeUp', ['kenya', 'tanzania'], 'Amboseli, the Mara and the Serengeti and Ngorongoro Crater are the easiest places in the world to get close, clear views and photographs.'],
  ['skiingSnowboarding', 'beginnerFriendly', ['dolomites', 'whistler'], 'Wide green runs, ski schools and learning areas: the Dolomites (Alpe di Siusi, Sella Ronda greens) and Whistler Blackcomb.'],
  ['skiingSnowboarding', 'crossCountry', ['lapland', 'swissalps', 'bavaria-munich'], "The column's own anchor: 300 km or more of groomed trail and a Nordic ski culture (Lapland, the Engadin and Davos, Seefeld and the Bavarian trails)."],
  ['skiingSnowboarding', 'snowboardParks', ['whistler', 'aspen'], 'Whistler and Aspen Snowmass (Buttermilk, home of the X Games) have the best terrain parks in the world.'],
  ['surfing', 'beginnerRating', ['costa-rica', 'bali'], 'Soft sandy-bottom waves with schools and rentals on the beach: Costa Rica and Bali are the benchmark places to learn.'],
  ['traditionalCrafts', 'seriousPieces', ['istanbul', 'bali', 'chiang-mai'], 'Established dealers and exporters for rugs, ceramics, furniture and lacquerware, with shipping routine.'],
  ['whaleWatching', 'closeness', ['antarctica', 'churchill'], 'Long, close encounters from small boats: Antarctic whales surfacing by the boat and Churchill belugas around the boat with calves.'],
  ['wildflowerBlooms', 'meadowRating', ['dolomites', 'texas-hill-country'], "The column's own examples: Alpe di Siusi and the Texas bluebonnets."],
  ['wildflowerBlooms', 'woodlandRating', ['nepal', 'great-smoky-mountains'], "The column's own example, the Nepal rhododendron forests; the Smokies' spring wildflower pilgrimage (trillium, rhododendron) is the North American benchmark."],
  ['windSports', 'wingFoilingRating', ['andalucia', 'maui', 'sardinia'], "The column's own examples: Sardinia, Maui and Tarifa."],
];
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { placeInterestFacts, interestReviews } = await import('../src/lib/db/schema');
  const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write');
  const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  const notes: Record<string, string[]> = {};
  for (const [interest, col, ids, why] of PROMOTIONS) {
    for (const id of ids) {
      const [row] = await db.select().from(placeInterestFacts).where(and(eq(placeInterestFacts.placeId, id), eq(placeInterestFacts.interestKey, interest)));
      const cur = (row?.facts as Record<string, unknown> | undefined)?.[col];
      if (typeof cur !== 'number') { console.log(`SKIP ${interest}.${col} ${id}: no number (${String(cur)})`); continue; }
      if (cur >= 10) continue;
      console.log(`${interest}.${col} ${id}: ${cur} -> 10`);
      (notes[interest] ??= []).push(`${col}: ${id} ${cur} to 10 (${why})`);
      if (apply) await db.update(placeInterestFacts).set({ facts: { ...(row.facts as object), [col]: 10 } as never, updatedAt: new Date() }).where(and(eq(placeInterestFacts.placeId, id), eq(placeInterestFacts.interestKey, interest)));
    }
  }
  if (apply) for (const [interest, lines] of Object.entries(notes)) {
    const values = { interestKey: interest, placeId: null, reviewerName: 'Claude (10s check, 28 Oct 2026)', reviewerRole: 'AI: Claude', reviewedOn: '2026-10-28', notes: 'Owner asked for a handful of 10s in every scored column. Raised to 10: ' + lines.join('; ') + '.', createdBy: CLAUDE_ACTOR.email };
    const [ex] = await db.select().from(interestReviews).where(and(eq(interestReviews.interestKey, interest), eq(interestReviews.reviewerName, values.reviewerName)));
    if (ex) continue;
    await withAdminAudit({ actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_review', entityId: `${interest}:new`, action: 'create', before: null, after: values, write: (tx) => tx.insert(interestReviews).values(values).returning() });
  }
  console.log(apply ? 'applied' : 'dry run: pass --apply');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
