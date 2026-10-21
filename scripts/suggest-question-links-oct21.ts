// 21 Oct 2026: proposes which chips should open which questions, only where it is very clear that the question means nothing unless the chip is
// ticked (a question about tasting menus opens with the Tasting menus chip; "skis or snowboard?" does not open for cross-country skiers).
// They are saved as SUGGESTED links: they change nothing and take no approval away until the owner accepts them in the Grid view of the admin.
// Usage: PLACE_ROWS_SNAPSHOT=1 npx tsx scripts/suggest-question-links-oct21.ts [--apply]
import { readFileSync } from 'fs';
import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i < 0) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }

// [interest, start of the question's text, chips that should open it]
const LINKS: Array<[string, string, string[]]> = [
  ['cyclingRoad', 'Supported or self-supported', ['Multi-day touring']],
  ['fineDining', 'How much are you willing to spend on a memorable tasting menu', ["Tasting menus and chef's tables"]],
  ['geologyVolcanoes', 'Look at a volcano, or climb one', ['Active volcanoes']],
  ['geologyVolcanoes', 'How do you feel about hazards', ['Active volcanoes', 'Geysers and geothermal fields']],
  ['kayakingRafting', 'How wild a ride', ['Whitewater rafting', 'Multi-day river trips']],
  ['mountaineering', 'How committing a day', ['Rock climbing', 'Alpine climbing']],
  ['museumsArt', 'How much does skipping the queue matter', ['Fine art masterworks', 'History and natural history museums', 'Modern Art']],
  ['nightlife', 'How dressed up', ['Clubs and dancing', 'Cocktail and rooftop bars']],
  ['shopping', 'How do you feel about haggling', ['Markets and bazaars', 'Local crafts and souvenirs', 'Vintage and antiques']],
  ['skiingSnowboarding', 'Skis or snowboard', ['Downhill resort skiing', 'Off-piste and backcountry', 'Heli-skiing and cat-skiing']],
  ['spaWellness', 'How do you feel about nude or mixed baths', ['Thermal baths and hammams']],
  ['stargazing', 'How cold and high will you go', ['Remote and high-altitude clear skies']],
  ['streetFood', 'How do you like to eat street food', ['Street stalls and hawker centers', 'Night markets']],
  ['wineSpirits', 'Who drives between tastings', ['Vineyards and wine regions', 'Whisky and spirits distilleries']],
  ['wineSpirits', 'How do you like to taste', ['Vineyards and wine regions']],
  ['yogaRetreats', 'Which style', ['Yoga retreats']],
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
