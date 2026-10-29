// 21 Oct 2026, second pass: proposes more chips to open questions (see the note above the list). The first pass (very clear links only) is in suggest-question-links-oct21.ts that the question means nothing unless the chip is
// ticked (a question about tasting menus opens with the Tasting menus chip; "skis or snowboard?" does not open for cross-country skiers).
// They are saved as SUGGESTED links: they change nothing and take no approval away until the owner accepts them in the Grid view of the admin.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/suggest-question-links-oct21.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// Second pass (21 Oct 2026): the first pass kept only links where it was very clear. This one asks of every question: is there an approved chip
// that makes it pointless? (a gear question for a glamping traveler, an alpine-level question for a cross-country skier, a ticket question for a
// free street parade). Where yes, the question opens only for the chips it fits.
// [interest, start of the question's text, chips that should open it]
const LINKS: Array<[string, string, string[]]> = [
  ['beachesSwimming', 'How warm must the water be', ['Calm swimming water', 'White sand', 'Resort beaches', 'Remote and empty beaches']],
  ['campingBackcountry', 'Bring gear, or rent it', ['Car camping', 'Backpacking', 'Free wild camping allowed']],
  ['campingBackcountry', 'How do you feel about bears', ['Car camping', 'Backpacking', 'Free wild camping allowed']],
  ['campingBackcountry', 'How cold will you sleep', ['Car camping', 'Backpacking', 'Free wild camping allowed']],
  ['coffeeTea', 'Linger or quick stop', ['Specialty cafés and roasteries', 'Tea ceremonies and tea houses']],
  ['festivals', 'How far ahead will you book tickets', ['Music festivals', 'Food and drink festivals', 'Sporting events']],
  ['fineDining', 'How far ahead will you book', ['Michelin-starred restaurants', "Tasting menus and chef's tables"]],
  ['golf', 'How far ahead can you book a tee time', ['Bucket-list courses', 'Links golf']],
  ['hiking', 'How high are you comfortable going', ['Day hikes', 'Multi-day treks', 'Hut-to-hut']],
  ['hiking', 'How do you feel about booking ahead', ['Multi-day treks', 'Hut-to-hut']],
  ['historyArchaeology', 'How rough a site can you walk', ['Ancient ruins', 'Prehistoric sites']],
  ['horsebackRiding', 'Riding with local horsemen', ['Ranch stays and cattle drives', 'Wilderness pack trips']],
  ['indigenousCultures', 'How basic a stay is fine', ['Homestays']],
  ['museumsArt', 'How long in a museum', ['Fine art masterworks', 'History and natural history museums', 'Modern Art']],
  ['museumsArt', 'Big famous museums, or small and quirky', ['Fine art masterworks', 'History and natural history museums', 'Modern Art']],
  ['religiousSites', 'Would you stay at a monastery', ['Pilgrimage routes', 'Temples and shrines']],
  ['safari', 'How do you want to reach camp', ['Great migration', 'Walking safaris', 'Boat and canoe safaris']],
  ['sailing', 'Who sails the boat', ['Sheltered island hopping', 'Expedition sailing']],
  ['sailing', 'How rough a sea can you take', ['Racing and regattas', 'Expedition sailing']],
  ['skiingSnowboarding', 'What is your level', ['Downhill resort skiing', 'Off-piste and backcountry', 'Heli-skiing and cat-skiing']],
  ['skiingSnowboarding', 'How much does après-ski', ['Downhill resort skiing']],
  ['streetFood', 'How careful about hygiene', ['Night markets', 'Street stalls and hawker centers', 'Fresh produce markets', 'Food tours']],
  ['surfing', 'How do you feel about shallow reef', ['Big, powerful waves', 'Point breaks']],
];

(async () => {
  const apply = process.argv.includes('--apply');
  const { db } = await import('../src/lib/db/client');
  const { interestChips, interestQuestions, interestQuestionChips } = await import('../src/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  const rows: Array<{ interestKey: string; questionKey: string; chipKey: string; suggested: boolean; createdBy: string }> = [];
  for (const [ik, start, chipLabels] of LINKS) {
    const qs = (await db.select().from(interestQuestions).where(eq(interestQuestions.interestKey, ik))).filter((q) => q.text.toLowerCase().startsWith(start.toLowerCase()));
    if (qs.length !== 1) throw new Error(`${ik}: expected one question starting "${start}", found ${qs.length}`);
    const chips = await db.select().from(interestChips).where(eq(interestChips.interestKey, ik));
    for (const label of chipLabels) {
      const c = chips.find((x) => x.label.toLowerCase() === label.toLowerCase());
      if (!c) throw new Error(`${ik}: no chip "${label}"`);
      rows.push({ interestKey: ik, questionKey: qs[0].questionKey, chipKey: c.chipKey, suggested: true, createdBy: 'Claude (suggested, 21 Oct 2026)' });
    }
    console.log(`${ik}: "${qs[0].text}" -> ${chipLabels.join(' | ')}`);
  }
  console.log(`${LINKS.length} questions, ${rows.length} suggested links`);
  if (!apply) { console.log('dry run: pass --apply to write'); process.exit(0); }
  await db.insert(interestQuestionChips).values(rows).onConflictDoNothing();
  console.log('saved');
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.message); process.exit(1); });
