// Moves the 17 onboarding questions the owner selected on 17 Oct 2026 (docs/onboarding-v2/QUESTIONS.md) into the admin
// (interest_questions). They are recorded as approved on 17 Oct, the day the owner selected them. Columns point at the data that now exists
// (several were "Structure" in the doc and have since been built: dayHikeEffort, bookingAhead, birding guide/access/drawConfidence).
// Skips an interest that already has questions, so it is safe to run twice.
//
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/seed-interest-questions-oct19.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue;
  let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
  if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v;
}
type Q = { text: string; options: string[]; maxPicks?: number; kind: 'lean' | 'limit'; columns: string[]; note: string };
const QUESTIONS: Record<string, Q[]> = {
  hiking: [
    { text: 'How big a day on the trail suits you?', options: ['Short and gentle, 2 to 3 hours', 'A solid half day', 'A full day with real hills', 'A big day, 8 hours or more of effort'], kind: 'lean', columns: ['dayHikeEffort'], note: 'Signature day hikes (difficulty and length).' },
    { text: 'How much company do you want on the trail?', options: ['Just us, solitude matters', 'A few others is fine', 'Does not matter', 'I like a lively, busy trail'], kind: 'lean', columns: ['crowdIndicators'], note: 'Crowding evidence (five yes/no signs of crowding).' },
    { text: 'How high are you comfortable going?', options: ['Stay low', 'Up to 2,500 m (8,000 ft)', 'Up to 4,000 m (13,000 ft)', 'The thin air is part of the appeal'], kind: 'limit', columns: ['altitude'], note: 'Altitude.' },
    { text: 'How do you feel about booking ahead?', options: ['I decide on the day', 'A few weeks ahead is fine', 'Happy to plan months ahead for a famous route'], kind: 'limit', columns: ['bookingAhead'], note: 'Permits, fees or guide rules.' },
    { text: 'What makes a hike worth it for you?', options: ['Big views', 'Lakes and waterfalls', 'Wildlife', 'Villages and culture on the way', 'The challenge itself'], maxPicks: 2, kind: 'lean', columns: [], note: 'No column yet: needs a new one.' },
  ],
  birding: [
    { text: 'What does a great birding trip look like for you?', options: ['Adding as many new species as possible', 'Finding one special bird', 'Beautiful, showy birds and good photos', 'Relaxed mornings, whatever turns up'], kind: 'lean', columns: ['species', 'endemismRating', 'charisma', 'viewsPhoto'], note: 'Species count, endemism rating, charisma, close-up ease.' },
    { text: 'Would you hire a local guide?', options: ['No, I go on my own', 'A half day here and there', 'A guide every day is fine'], kind: 'limit', columns: ['guide'], note: 'Guide needed?' },
    { text: 'How much walking will you do to find the birds?', options: ['Mostly from the car or the lodge', 'Easy trails', 'Real hiking to reach them'], kind: 'limit', columns: ['access'], note: 'Accessibility.' },
    { text: 'How much does a sure thing matter?', options: ['A reliable spot where the birds are almost always there', 'A bit of a gamble is fine', 'I would gamble for a rarity'], kind: 'lean', columns: ['drawConfidence'], note: 'Draw confidence.' },
  ],
  safari: [
    { text: 'Which animal would make the trip for you?', options: ['Leopard', 'Lion', 'Cheetah', 'Elephant', 'Rhino', 'Wild dog', 'Tiger'], maxPicks: 2, kind: 'lean', columns: ['leopard', 'lion', 'cheetah', 'elephant', 'rhino', 'wildDog', 'tiger'], note: 'The odds grid, one column per animal.' },
    { text: 'How do you feel about sharing a sighting?', options: ['Just my vehicle', 'A few vehicles is fine', 'Crowds are fine if the animal is great'], kind: 'lean', columns: ['crowding'], note: 'Crowding.' },
    { text: 'How do you feel about malaria precautions?', options: ['I want to avoid malaria areas', 'Fine with precautions and the right season', 'No concern'], kind: 'limit', columns: ['malaria'], note: 'Malaria.' },
    { text: 'How do you want to reach camp?', options: ['By road the whole way', 'Short bush flights are fine', 'Remote fly-in camps are the dream'], kind: 'lean', columns: ['access'], note: 'Access.' },
    { text: 'How much do night drives and going off-road matter?', options: ['Not at all', 'Nice to have', 'Must have'], kind: 'lean', columns: ['nightDrives', 'offRoad'], note: 'Night drives, off-road driving.' },
  ],
  whaleWatching: [
    { text: 'How do you handle the sea?', options: ['I am a good sailor', 'Fine in calm water', 'I get queasy'], kind: 'limit', columns: ['seasick'], note: 'Seasickness risk.' },
    { text: 'What kind of boat feels right?', options: ['Small fast boat, close to the water', 'Mid-size, comfortable', 'Large ship with a deck and a cafe', 'Sailing boat, quiet'], maxPicks: 2, kind: 'lean', columns: ['boatStyle'], note: 'Boat style.' },
    { text: 'How sure must the sighting be?', options: ['Nearly guaranteed', 'Likely is fine', 'I would gamble for a rare animal'], kind: 'lean', columns: ['humpback', 'sperm', 'minke', 'orca', 'blue', 'fin', 'gray', 'right', 'dolphins'], note: 'The odds written into each whale entry.' },
  ],
};
(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestQuestions } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const { factDefsFor } = await import('../src/lib/admin/interest-pages/config');
  let n = 0;
  for (const [interestKey, qs] of Object.entries(QUESTIONS)) {
    const defs = factDefsFor(interestKey);
    for (const q of qs) for (const c of q.columns) if (!defs.some((d) => d.key === c)) throw new Error(`${interestKey}: no column ${c}`);
    if ((await db.select().from(interestQuestions).where(eq(interestQuestions.interestKey, interestKey))).length) { console.log(interestKey, 'already has questions, skipped'); continue; }
    const rows = qs.map((q, i) => ({
      interestKey, questionKey: `q${i + 1}`, sortOrder: i + 1, text: q.text, options: q.options, maxPicks: q.maxPicks ?? 1, kind: q.kind, columns: q.columns, note: q.note,
      approvedBy: 'brileysp@gmail.com (selected in chat 17 Oct 2026; recorded by Claude on 19 Oct)', approvedAt: new Date('2026-10-17T12:00:00Z'), updatedBy: 'Claude (moved from QUESTIONS.md, 19 Oct 2026)',
    }));
    if (apply) await db.insert(interestQuestions).values(rows);
    n += rows.length;
  }
  console.log(`${apply ? 'wrote' : 'would write'} ${n} questions`);
  process.exit(0);
})();
