import { describe, expect, it } from 'vitest';
import { scanText, TEXT_RULES, scanStructure, monthsNamed, isContiguous, scanSky, flatAllYear } from '@/lib/authoring/rules';

describe('authoring text rules', () => {
  it('flags filler, "offers" and promotional words', () => {
    expect(scanText('Museums are open year-round.', [])).toContain('filler');
    expect(scanText('The town offers great views.', [])).toContain('offers');
    expect(scanText('A stunning old town.', [])).toContain('promo');
    expect(scanText('It is more than just a market.', [])).toContain('contrast');
  });
  it('does not flag Paradise Island or the Financial Centre', () => {
    expect(scanText('Dining is concentrated on Paradise Island.', [])).not.toContain('promo');
    expect(scanText('Restaurants in the Dubai International Financial Centre.', [])).not.toContain('units');
  });
  it('checks blurbs as well as the overview', () => {
    expect(scanText('Fine overview.', ['Everything runs all year.'])).toContain('filler');
  });
  it('flags a drinks overview that opens with the whole range', () => {
    expect(scanText('The Algarve produces distinct regional wines and traditional spirits. The Algarve DOC covers Lagoa.', [], { drinks: true })).toContain('rangeOpener');
    expect(scanText('The Algarve DOC covers subregions like Lagoa and Tavira. Inland, the Monchique mountains make a strong brandy.', [], { drinks: true })).not.toContain('rangeOpener');
  });
  it('flags two drink families in one sentence joined by "or"', () => {
    expect(scanText('Visitors can tour wineries or taste local gin.', [], { drinks: true })).toContain('mixedSentence');
    expect(scanText('Visitors can tour the wineries.', [], { drinks: true })).not.toContain('mixedSentence');
  });
  it('applies the drinks heuristics only to drinks interests', () => {
    expect(scanText('The region produces wines and spirits.', [], {})).not.toContain('rangeOpener');
  });
  it('gives every fix rule an instruction for the copy-editing pass', () => {
    for (const r of TEXT_RULES.filter((x) => x.kind === 'fix')) expect(r.ask, r.id).toBeTruthy();
  });
});

describe('stargazing-only rules', () => {
  it('flag the moon, Bortle jargon and pasted figures only when sky is on', () => {
    expect(scanText('Dark skies with no moonlight.', [], { sky: true })).toContain('moon');
    expect(scanText('A Bortle class 2 sky.', [], { sky: true })).toContain('bortle');
    expect(scanText('Nights bring 9 to 11 hours of true darkness.', [], { sky: true })).toContain('figures');
    expect(scanText('Cloud cover is around 60 percent.', [], { sky: true })).toContain('figures');
    expect(scanText('Dark skies with no moonlight, Bortle 2, 60 percent cloud.', [])).toEqual([]);
  });
});

describe('month-blurb structure rules', () => {
  it('reads month names, and May only when it is the month', () => {
    expect(monthsNamed('The tea harvest runs from April to September.')).toEqual([4, 9]);
    expect(monthsNamed('Rain may fall. May is the start.')).toEqual([]);
    expect(monthsNamed('Dry from May through August.').sort()).toEqual([5, 8]);
  });
  it('knows which month groups are neighbors, with December next to January', () => {
    expect(isContiguous([11, 12, 1, 2])).toBe(true); expect(isContiguous([5, 10])).toBe(false); expect(isContiguous([4, 9, 10])).toBe(false); expect(isContiguous([6])).toBe(true);
  });
  it('flags a blurb that names a month it does not cover, or only some of the months it covers (the one-month test)', () => {
    expect(scanStructure([{ months: [4, 5, 6, 7, 8], text: 'The harvest runs through October.' }])).toContain('otherMonth');
    expect(scanStructure([{ months: [4, 5, 6, 7, 8, 9, 10], text: 'From May to August the core is well placed.' }])).toContain('partialMonths');
    // Naming the group's own span is not a one-month-test failure, but since 14 Nov 2026 a grouped blurb may not name months at all (groupTalk, below).
    expect(scanStructure([{ months: [5, 6, 7, 8], text: 'From May to August the core is well placed.' }])).not.toContain('partialMonths');
    expect(scanStructure([{ months: [12, 1, 2], text: 'Snow from December to February.' }])).not.toContain('otherMonth');
  });
  it('flags months that are not neighbors being grouped while naming a month or season', () => {
    expect(scanStructure([{ months: [5, 10], text: 'Snow clears in May while October brings the first snows.' }])).toContain('disparateNamed');
    expect(scanStructure([{ months: [4, 9, 10], text: 'Skies are very clear and the core is up for only part of the night.' }])).not.toContain('disparateNamed');
    expect(scanStructure([{ months: [3, 9], text: 'Spring brings more cloud.' }])).toContain('disparateNamed');
    expect(scanStructure([{ months: [3, 9, 10], text: 'These transition months bring increasing clouds.' }])).toContain('disparateNamed');
    expect(scanStructure([{ months: [11, 12, 1, 2], text: 'Winter brings long nights.' }])).not.toContain('disparateNamed');
  });
  it('flags a group whose scores differ by more than 1.5', () => {
    const scores = [5.2, 5.1, 5.6, 6.9, 8.6, 8.4, 8.3, 8.2, 8.4, 8.7, 6.1, 5.4];
    expect(scanStructure([{ months: [11, 12, 1, 2, 3, 4], text: 'x' }], scores)).toContain('wideGroup');
    expect(scanStructure([{ months: [11, 12, 1, 2, 3], text: 'x' }], scores)).not.toContain('wideGroup');
    // 0.5 to 1.5: only unexpected curves are flagged
    const s2 = [7, 7.3, 7.7, 8, 8, 8, 8, 8, 8, 8, 7.8, 7.2]; // jan to mar a smooth climb of 0.7
    expect(scanStructure([{ months: [1, 2, 3], text: 'x' }], s2)).not.toContain('splitConsider');
    const s3 = [7.5, 7, 7.9, 8, 8, 8, 8, 8, 8, 8, 8, 8]; // a dip in the middle
    expect(scanStructure([{ months: [1, 2, 3], text: 'x' }], s3)).toContain('splitConsider');
    expect(scanStructure([{ months: [1, 2, 3], text: 'x' }], [6, 6.6, 7.2, 8, 8, 8, 8, 8, 8, 8, 8, 8])).toContain('splitConsider'); // smooth but 1.2 apart
  });
  it('flags a blurb that groups months that are not neighbors', () => {
    expect(scanStructure([{ months: [3, 4, 9], text: 'Clear nights.' }], undefined)).toContain('nonNeighbors');
    expect(scanStructure([{ months: [11, 12, 1, 2], text: 'Clear nights.' }], undefined)).not.toContain('nonNeighbors');
  });
  it('flags a blurb that talks about its group instead of speaking as if for one month', () => {
    expect(scanStructure([{ months: [11, 12, 1, 2], text: 'These are the wettest months, and the city often floods.' }], undefined)).toContain('groupTalk'); // the owner's Venice example, 14 Nov 2026 (wettest months)
    expect(scanStructure([{ months: [11, 12, 1, 2], text: 'From November to February the squares flood.' }], undefined)).toContain('groupTalk');
    expect(scanStructure([{ months: [3, 4], text: 'The cloud thins out compared with deep winter, a quiet stretch.' }], undefined)).not.toContain('groupTalk');
    expect(scanStructure([{ months: [12], text: 'December brings the first snow.' }], undefined)).not.toContain('groupTalk'); // a single month may be named
    expect(scanStructure([{ months: [11, 12, 1, 2], text: 'High water often floods low-lying areas and fog is common.' }], undefined)).not.toContain('groupTalk');
  });
  it('flags saying what a place is not', () => {
    const hits = (t: string) => scanText(t, []);
    expect(hits("Venice's scenery is entirely urban and aquatic, defined by its canals rather than natural landscapes.")).toContain('notKnownFor'); // rather than natural landscapes
    expect(hits('The city is not known for beaches.')).toContain('notKnownFor');
    expect(hits("Venice's scenery is defined by its canals, lagoons, and historic architecture.")).not.toContain('notKnownFor');
  });
  it('the new text rules catch the owner\'s examples', () => {
    expect(scanText('Pool decks remain fully accessible.', [])).toContain('accessibleFiller');
    expect(scanText('The region lacks natural beaches.', [])).toContain('lacks');
    expect(scanText('There is no true night in June.', [], { sky: true })).toContain('trueNight');
  });
});

describe('light interests are implied, not named (owner, 15 Nov 2026)', () => {
  it('flags the word sunbathing (and verdicts built on it) and "scenic landscapes" only when casual is on', () => {
    expect(scanText('Sedona offers sunbathing primarily through its resort pools.', [], { casual: true })).toContain('interestNamed');
    expect(scanText('Winter is cold. Sunbathing is generally out of the question.', [], { casual: true })).toContain('interestNamed');
    expect(scanText('Aruba is a premier destination for sunbathing, known for its sunshine.', [], { casual: true })).toContain('interestNamed');
    expect(scanText('Fine overview.', ['Highs only reach the 50s, too cold for sunbathing, though the days are lengthening.'], { casual: true })).toContain('interestNamed');
    expect(scanText('June is marginal sunbathing weather.', [], { casual: true })).toContain('interestNamed');
    expect(scanText('Visitors come for the best scenic landscapes in the region.', [], { casual: true })).toContain('interestNamed');
  });
  it('lets plain descriptions through, and ignores other interests', () => {
    expect(scanText('Winter highs in the 50s and low 60s mean the air is too cold to lie out comfortably.', [], { casual: true })).not.toContain('interestNamed');
    expect(scanText('Sedona has numerous resort pools set against the red rocks.', [], { casual: true })).not.toContain('interestNamed');
    expect(scanText('Sunbathing is popular here.', [])).not.toContain('interestNamed');
  });
});

describe('an overview does not end with a recap sentence (owner, 16 Nov 2026)', () => {
  const badlands = 'The region contrasts the sharply eroded, banded buttes of the Badlands with the dark, pine-covered granite peaks of the Black Hills. Scenic drives such as the Needles Highway and Badlands Loop Road navigate narrow rock tunnels, steep canyons, and vast prairie overlooks. The landscapes range from dry, colorful desert pinnacles to dense mountain forests.';
  it('flags a closing sentence that only restates what the overview already said', () => {
    expect(scanText(badlands, [])).toContain('recap');
    expect(scanText('Fjords cut deep into the coast. Waterfalls drop from the cliffs. Overall, the scenery is a mix of water and rock.', [])).toContain('recap');
  });
  it('lets a closing sentence that adds a new fact through, and short overviews', () => {
    expect(scanText('The region has sharply eroded buttes. Scenic drives such as the Needles Highway pass through narrow rock tunnels. Mount Rushmore sits in the Black Hills.', [])).not.toContain('recap');
    expect(scanText('Granite cliffs rise above the valley. The landscapes range from dry to green.', [])).not.toContain('recap');
  });
});

describe('stargazing wording follows the sky, not a guess (owner, 16 Nov 2026, Practice Batch Three)', () => {
  const ladakh = 'The high passes open, allowing access to the darkest skies. The Milky Way\'s bright core is well placed, though nights are short and moderate cloud can occasionally obscure the view.';
  it('never talks about the length of the night closer to the equator than Seattle', () => {
    expect(scanSky('Fine overview.', [{ months: [5, 6, 7], text: ladakh }], 34.1)).toContain('nightLengthNearEquator');
    expect(scanSky('Fine overview.', [{ months: [5, 6, 7], text: ladakh }], 66.5)).not.toContain('nightLengthNearEquator');
    expect(scanSky('Long nights suit the high deserts.', [], -22)).toContain('nightLengthNearEquator');
  });
  it('does not say when in the evening the Milky Way can be seen', () => {
    expect(scanText('Fine.', ['The skies are very clear. The Milky Way is visible early in the evening.'], { sky: true })).toContain('milkyWayTime');
    expect(scanText('Fine.', ['The bright core of the Milky Way is up in the small hours.'], { sky: true })).toContain('milkyWayTime');
    expect(scanText('Fine.', ['The bright core of the Milky Way is well placed.'], { sky: true })).not.toContain('milkyWayTime');
  });
  it('keeps months with different skies in different blurbs and does not overstate a month where most stars still show', () => {
    const sval = 78.2;
    expect(scanSky('Fine.', [{ months: [4, 5, 6, 7, 8], text: 'The midnight sun and all-night twilight mean the sky never gets dark enough to see a star.' }], sval)).toContain('skyBandMix');
    expect(scanSky('Fine.', [{ months: [4], text: 'Twilight lasts all night, so no star shows.' }, { months: [5, 6, 7, 8], text: 'The sun stays up all night, so no star shows.' }], sval)).not.toContain('skyBandMix');
    expect(scanSky('Fine.', [{ months: [3], text: 'The sky never gets fully dark as the sun stays closer to the horizon, but most stars are still visible when the clouds break.' }], sval)).toContain('neverDarkOverstated');
    expect(scanSky('Fine.', [{ months: [3], text: 'Twilight lingers and the faintest stars are lost, but most stars still show when the clouds break.' }], sval)).not.toContain('neverDarkOverstated');
  });
});

describe('a shared blurb describes one condition, not a change (owner, 17 Nov 2026, Bordeaux)', () => {
  it('flags sequence wording inside a blurb that covers several months', () => {
    const bordeaux = 'The vineyards of the Médoc fill in with green foliage, eventually turning gold and red by early autumn. The water mirror at the Place de la Bourse is active, reflecting the grand architecture along the Garonne river.';
    expect(scanStructure([{ months: [4, 5, 6, 7, 8, 9, 10], text: bordeaux }])).toContain('sequenceWords');
    expect(scanStructure([{ months: [3, 4], text: 'The high trails gradually clear of snow.' }])).toContain('sequenceWords');
    expect(scanStructure([{ months: [6, 7, 8, 9], text: 'The hills turn green and purple with heather by late summer.' }])).toContain('sequenceWords');
  });
  it('lets a single month describe its own change, and ordinary times of day through', () => {
    expect(scanStructure([{ months: [10], text: 'The vine leaves turn gold and red, and the grapes are gradually picked.' }])).not.toContain('sequenceWords');
    expect(scanStructure([{ months: [4, 5, 6], text: 'Coastal fog is common in the mornings, often burning off by midday.' }])).not.toContain('sequenceWords');
  });
});

describe('flat all year (Scenic Landscapes, 18 Nov 2026)', () => {
  it('flags Death Valley, Dubai, Kruger and London as scored flat in all twelve months', () => {
    expect(flatAllYear(Array(12).fill(9.5))).toBe(true); // Death Valley before the fix
    expect(flatAllYear(Array(12).fill(8.2))).toBe(true); // Dubai before the fix
    expect(flatAllYear(Array(12).fill(4.8))).toBe(true); // Kruger before the fix
    expect(flatAllYear(Array(12).fill(6))).toBe(true); // London before the fix
  });
  it('does not flag a curve or a closed place', () => {
    expect(flatAllYear([9.4, 9.5, 9.5, 9.1, 8.4, 7.6, 7.1, 7.3, 8.0, 8.9, 9.3, 9.4])).toBe(false);
    expect(flatAllYear(Array(12).fill(0))).toBe(false);
  });
});

describe('place is the subject, and sentences make sense (Scenic Landscapes, 18 Nov 2026)', () => {
  it('flags "Northern Ireland\u2019s scenery is known for" and the same with landscape or views', () => {
    expect(scanText('Northern Ireland\u2019s scenery is known for its dramatic coastline, anchored by the Giant\u2019s Causeway.', [], { casual: true })).toContain('sceneryKnownFor');
    expect(scanText('The landscape is known for towering sandstone cliffs.', [], { casual: true })).toContain('sceneryKnownFor');
    expect(scanText('The coastal scenery of Fife is known for rugged shorelines.', [], { casual: true })).toContain('sceneryKnownFor');
  });
  it('does not flag the place as the subject, or a scenery sentence about timing', () => {
    expect(scanText('Northern Ireland is known for its dramatic coastline, anchored by the Giant\u2019s Causeway.', [], { casual: true })).not.toContain('sceneryKnownFor');
    expect(scanText('The scenery is best viewed during the drier months.', [], { casual: true })).not.toContain('sceneryKnownFor');
  });
  it('flags the rocky coves of Point Lobos put inland, and not a correct sentence', () => {
    expect(scanText('Inland, the scenery shifts to dense groves of coastal redwoods and the rocky coves of Point Lobos.', [])).toContain('inlandCoast');
    expect(scanText('Point Lobos adds rocky coves near Monterey, and inland, dense groves of coastal redwoods fill the canyons.', [])).not.toContain('inlandCoast');
  });
});

