// 9 Nov 2026: fills the Rules tab of the six interests written through the family directive (Museums & Art, Architecture, Fine Dining, Street Food, Coffee & Tea,
// Wine, Beer & Spirits) with their scope, writing rules, scoring notes and a dated log of what was learned. The admin page shows any "family.*" section for an interest
// that has no hand-built rules component, and each list can be edited there. Safe to re-run: skips a section that already exists unless --force. Dry run unless --apply.
import { readFileSync } from 'fs'; import { join } from 'path';
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) { const t = line.trim(); if (!t || t.startsWith('#')) continue; const i = t.indexOf('='); if (i === -1) continue; let v = t.slice(i + 1).trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); if (process.env[t.slice(0, i).trim()] === undefined) process.env[t.slice(0, i).trim()] = v; }
type Item = { title: string; body: string };
const KEYS = ['museumsArt', 'architecture', 'fineDining', 'streetFood', 'coffeeTea', 'wineSpirits'];
const LABEL: Record<string, string> = { museumsArt: 'Museums & Art', architecture: 'Architecture', fineDining: 'Fine Dining', streetFood: 'Street Food & Markets', coffeeTea: 'Specialty Coffee & Tea', wineSpirits: 'Wine, Beer & Spirits' };

const COMMON_WRITING: Item[] = [
  { title: 'No individual businesses', body: 'Do not name roasters, cafes, tea estates, coffee farms, wineries, breweries, distilleries, restaurants, hotels, shops or tour operators; say "local roasters" or "a working tea farm". The one exception is a business that is itself the reason the place is known for the interest (Guinness in Ireland). Festivals, trails, districts, market halls and protected drink names are not businesses and stay. Added 3 Nov 2026.' },
  { title: 'Banned wording', body: '"Year-round", "all year", "every season", "the same", "offers" (for what a place has), "for this interest", contrast framings ("more than just", "goes beyond"), and promotional words (boasts, world-class, stunning, legendary, hidden gem). No marketing claims about why something is good ("driven by local glacier water").' },
  { title: 'Biggest draw first', body: 'The first sentence of the overview names the single biggest draw. Do not open with a sentence that surveys the whole range and then goes back over each item. Added 6 Nov 2026.' },
  { title: 'One topic per sentence', body: 'Each drink, cuisine or kind of site gets its own sentence or clause. Never join two topics in one sentence with "or", "while" or "alongside". Lesser extras go last in a short closing sentence ("also produces..."). Added 6 Nov 2026.' },
  { title: 'Seasons stay with their topic', body: 'A best-months, harvest or closure clause sits next to the thing it describes, or is left to the month blurbs. Never tack it onto a sentence about something else (the Azores wine overview did this).' },
  { title: 'No novelty leads', body: 'Lead with what the place is really known for. Do not lead with, or list, a novelty such as pineapple or lychee wine; if beer is the major industry, lead with beer. Added 6 Nov 2026.' },
  { title: 'Length', body: 'Overview and month blurbs stay inside the maximum for the place\'s final peak score: under 4.0, 280 and 180 characters; 4.0 to 5.9, 380 and 260; 6.0 to 8.4, 450 and 320; 8.5 and up, 550 and 326. Going over is flagged on the review page; the owner may approve an overage.' },
  { title: 'Only claims that can be checked', body: 'Names, dates, seasons, closures and events are checked against sources before the owner reads them. If unsure, say less. US units and spelling.' },
];
const EXTRA_WRITING: Record<string, Item[]> = {
  museumsArt: [{ title: 'Name a museum only when it is the reason to go', body: 'And only when sure of it. Event-driven curves need the event\'s current status checked: fairs and festivals end, venues close and are renamed.' }],
  architecture: [{ title: 'Name a building only when it is the reason to go', body: 'And only when sure of it, including its date and style: for example the Arches visitor center is a 2005 building, not a Mission 66 one, and the Townsville Customs House dates from 1900 to 1902.' }],
  fineDining: [{ title: 'No restaurant, chef or hotel names', body: 'Describe the style of cooking and where the scene is concentrated (a city or district). Where cooking is not a reason to visit, say so plainly and keep the scores low.' }],
  streetFood: [{ title: 'Markets may be named, stalls may not', body: 'Market halls and named markets may be named; individual stalls and trucks may not. Where the street food is mainly farmers\' markets and weekly markets, write month blurbs for the thin months and score them.' }],
  coffeeTea: [{ title: 'What counts', body: 'Coffee and tea farms and estates count only if a visitor can reach them on a day trip; coffee served at lodges and hotels does not; chain cafes do not. Tea counts as much as coffee.' }],
  wineSpirits: [
    { title: 'Judge the whole scene', body: 'Beer, cider and spirits count as much as wine. Imported drinks alone do not count. Name regions, wine routes and festivals, not producers, bars or brewpubs.' },
    { title: 'Names that stay', body: 'Eight places keep a business name because it is the point of the entry: Barbados (Mount Gay, St. Nicholas Abbey), Svalbard (the northernmost brewery), Ireland (the Guinness Storehouse), Hokkaido (Sapporo Beer Museum, Nikka Yoichi), Taiwan (Kavalan), Palau (Red Rooster), Budapest (Unicum, Zwack) and Venice (Aperol, Campari, Select).' },
  ],
};
const COMMON_SCORING: Item[] = [
  { title: 'Where the month scores come from', body: 'Gemini returns twelve month scores in tenths with every text. They are compared with our own evidence columns and the old score. If the two peaks are within a point they are averaged; one to two and a half apart, the middle is used; further apart, the owner decides.' },
  { title: 'Gemini runs generous', body: 'In the first samples its peak was more than 2 points above ours in 90 of 226 cells, and its scale has no anchors across places. Scores are checked, not taken as given.' },
  { title: 'Even tenths', body: 'No clumping on x.0 and x.5: no more than about a quarter of a place\'s distinct scores sit there, and the last digits are spread evenly across the interest.' },
  { title: 'The top of the scale', body: 'The best places run from 10.0 downward in even steps, two places per value (one per value for Coffee & Tea): 10.0, 9.9, 9.8 and so on. The order follows the evidence. A peak is held for the place\'s three best months.' },
  { title: 'Seasonal drops', body: 'A month more than 2 points below the peak needs evidence. Heat, cold or crowds alone do not lower an indoor or all-year interest. Where there was no evidence either way the difference was split and flagged for later review (59 across the four Food interests).' },
  { title: 'Not applicable', body: 'N/A only when nothing exists within a day trip. Applicable wins over a Gemini N/A: places the owner keeps applicable get a second Gemini run told to write modestly, and a low score.' },
  { title: 'Rank checks', body: 'After a save, two checks: each place against others of its kind, then all places in one list. The owner accepts or declines each suggested move; a moved place keeps its curve shape and only the peak changes.' },
];
const EXTRA_SCORING: Record<string, Item[]> = {
  fineDining: [{ title: 'Evidence columns', body: 'Michelin-style counts and our fine dining ratings (see the Data tab).' }],
  streetFood: [{ title: 'Evidence columns', body: 'Night markets, street stalls and produce markets, each 0 to 10. Bar food and food halls (Barcelona, Chicago, Copenhagen, Dubai, the Basque Country) were moved below real street-food places at the rank check.' }],
  coffeeTea: [{ title: 'Evidence columns', body: 'Specialty cafes and tea ceremonies, each 0 to 10, plus whether coffee farms or tea plantations can be visited. One famous bean is not a culture: Jamaica was lowered, Istanbul and Rome raised at the rank check.' }],
  wineSpirits: [{ title: 'Evidence columns', body: 'Our wine, beer and spirits ratings. Old scores under-credited beer and spirits, so the whole scene is judged.' }],
  museumsArt: [{ title: 'Evidence columns', body: 'Our museum and art columns (see the Data tab). Low-peak places kept applicable by the owner get a short text and a low score.' }],
  architecture: [{ title: 'Evidence columns', body: 'Our architecture columns (see the Data tab). Low-peak places kept applicable by the owner get a short text and a low score.' }],
};
const COMMON_LESSONS: Item[] = [
  { title: '2 Nov 2026: show length from the first version', body: 'The first review pages did not show each text\'s length against its maximum or the total word count. They now do, and only going over the max (or a flagship overview under 60% of it) is flagged.' },
  { title: '2 Nov 2026: rebuild the review page after every save', body: 'A stale page showed Gemini\'s old text after the owner\'s edit was already saved (Raja Ampat), and she thought the edit had been lost.' },
  { title: '2 Nov 2026: a cap on seasonal drops was removed', body: 'A rule that capped how far a place\'s winter could fall below its peak (1.5 points for fine dining) was applied by Claude without evidence and removed after the owner questioned it. Seasonal drops are now judged one by one against sources.' },
  { title: '3 Nov 2026: kept-applicable places need a second run', body: 'When Gemini says N/A and the owner keeps the place applicable, a second run told to write modestly produces a short, low-scoring text. Seventeen places across five interests needed it.' },
];
const EXTRA_LESSONS: Record<string, Item[]> = {
  fineDining: [{ title: '2 Nov 2026: saved and reviewed', body: '185 texts saved; the owner trimmed 89 overviews. Gemini called 13 places N/A; the owner kept Bhutan and Zion & Bryce applicable.' }],
  streetFood: [
    { title: '2 to 3 Nov 2026: length review', body: 'The owner reviewed the 28 over-length places and trimmed them; 13 remain over and are approved as they are.' },
    { title: '2 Nov 2026: bar food ranked too high', body: 'Pintxo bars, tapas bars and food halls scored above real street-food places; ten rank moves were accepted.' },
  ],
  coffeeTea: [
    { title: '3 to 4 Nov 2026: business names', body: 'Gemini named roasters, estates and farms (the scope only forbade naming cafes and roasters): 13 names were removed (for example Finca Argovia, Zealong, Tregothnan).' },
    { title: '4 Nov 2026: Amalfi and Uganda', body: 'Amalfi was kept applicable and written modestly with a peak of 2.8. A question from the owner about Uganda added a sentence on Fort Portal tea estates.' },
  ],
  wineSpirits: [
    { title: '3 to 6 Nov 2026: business names', body: 'Gemini named producers, venues and brands despite the scope: 33 names were removed (Jameson, Penderyn, Marqués de Riscal, the Hofbräuhaus and others); eight were kept because the name is the point.' },
    { title: '6 Nov 2026: overview structure', body: 'Most overviews opened with a range sentence or mixed two drinks in one sentence. The owner asked for the biggest draw first, one drink per sentence and extras last (Andalucía is the model). Claude wrote a "clause alt" for 68 overviews; the owner called the alts "almost always better".' },
    { title: '6 Nov 2026: novelty and marketing', body: 'Pineapple and lychee wine were led with or listed (Maui, Mauritius) and removed; "driven by local glacier water" (Banff) was cut as marketing. Where beer is the major industry (Maui), lead with beer.' },
    { title: '6 Nov 2026: Hong Kong peak', body: 'Hong Kong was lowered from 4.8 to 3.7: a few breweries and distilleries, not a production region.' },
  ],
  museumsArt: [{ title: '31 Oct and 3 Nov 2026: fact checks', body: 'About a dozen of the first 354 Museums and Architecture texts were wrong (closures, renamed venues, ended events). In the kept-applicable batch Gemini invented a museum in the old Palacio de Sal at Uyuni (the hotel was dismantled in 2002), a Prime Art Gallery in Victoria Falls (it is in Livingstone) and a Bapa Bangun Museum in Ruteng; all were removed.' }],
  architecture: [{ title: '31 Oct and 3 Nov 2026: fact checks', body: 'About a dozen of the first 354 Museums and Architecture texts were wrong. In the kept-applicable batch, Arches was called Mission 66 (its visitor center opened in 2005) and Townsville\'s Customs House was called 19th century (it dates from 1900 to 1902).' }],
};

(async () => {
  const apply = process.argv.includes('--apply'); const force = process.argv.includes('--force');
  const scopes = JSON.parse(readFileSync(join(__dirname, 'data', 'family-scopes.json'), 'utf8')) as Record<string, { interests: Record<string, { about: string; notCount: string; scope: string }> }>;
  const { db } = await import('../src/lib/db/client'); const { interestRuleSections } = await import('../src/lib/db/schema'); const { and, eq } = await import('drizzle-orm');
  const { withAdminAudit } = await import('../src/lib/admin/write'); const { CLAUDE_ACTOR } = await import('../src/lib/admin/auth');
  let n = 0;
  for (const k of KEYS) {
    const fam = Object.values(scopes).find((f) => f.interests[k]); if (!fam) { console.log('NO SCOPE', k); continue; }
    const sc = fam.interests[k];
    const sections: Record<string, Item[]> = {
      'family.scope': [{ title: 'What it covers', body: sc.about }, { title: 'What does not count', body: sc.notCount }, { title: 'When it applies to a place', body: sc.scope }],
      'family.writing': [...COMMON_WRITING, ...(EXTRA_WRITING[k] ?? [])],
      'family.scoring': [...COMMON_SCORING, ...(EXTRA_SCORING[k] ?? [])],
      'family.lessons': [...COMMON_LESSONS, ...(EXTRA_LESSONS[k] ?? [])],
    };
    for (const [sectionKey, items] of Object.entries(sections)) {
      const [before] = await db.select().from(interestRuleSections).where(and(eq(interestRuleSections.interestKey, k), eq(interestRuleSections.sectionKey, sectionKey)));
      if (before && !force) continue;
      n++; console.log(`${apply ? 'saving' : 'would save'} ${LABEL[k]} ${sectionKey} (${items.length} items)`);
      if (!apply) continue;
      await withAdminAudit({
        actor: CLAUDE_ACTOR, skipPlaceCache: true, entityType: 'interest_rule_section', entityId: `${k}:${sectionKey}`, action: before ? 'update' : 'create',
        before: before ?? null, after: { interestKey: k, sectionKey, items },
        write: (tx) => tx.insert(interestRuleSections).values({ interestKey: k, sectionKey, items, updatedBy: CLAUDE_ACTOR.email }).onConflictDoUpdate({ target: [interestRuleSections.interestKey, interestRuleSections.sectionKey], set: { items, updatedBy: CLAUDE_ACTOR.email, updatedAt: new Date() } }).returning(),
      });
    }
  }
  console.log(`${apply ? 'saved' : 'would save'} ${n} sections`);
  process.exit(0);
})().catch((e) => { console.log('ERR', e.cause?.message ?? e.stack); process.exit(1); });
