import { lowestSunAltitudeByMonth } from '../astro/darkness';

/**
 * 9 Nov 2026: the writing rules for Gemini-authored texts, as data, in one place. The cleanup script, the status report and the text scanner all read this list, so a new
 * rule is added here once and reaches every interest. The human-readable version lives in prompts/_shared/authoring-core.md (what Gemini is told) and in each interest's
 * "Writing rules" card on the admin page; keep the three in step.
 *
 * kind 'fix' rules are mechanical: a copy-editing pass can repair them without changing facts. kind 'review' rules are heuristics for structure or content that a person
 * (or Claude, with the owner) judges; the scanner lists candidates and never rewrites them.
 */
export type RuleKind = 'fix' | 'review';
export interface TextRule {
  id: string;
  label: string;
  kind: RuleKind;
  /** Where it applies: every interest, only the drinks interests (Wine, Beer & Spirits), only Stargazing ('sky'), or only the light interests that are implied rather than named (Sunbathing, Scenic Landscapes: 'casual'). */
  scope: 'all' | 'drinks' | 'sky' | 'casual';
  /** JavaScript pattern source, case-insensitive. */
  source: string;
  /** The instruction sent to the copy-editing model when the pattern is found. */
  ask?: string;
}

export const TEXT_RULES: TextRule[] = [
  { id: 'filler', label: 'year-round filler', kind: 'fix', scope: 'all', source: 'year[- ]round|all year|throughout the year|every season|all seasons|regardless of|consistent(ly)?\\b|the same in every|any (time|season) of the year|open all', ask: 'Remove any statement that something is open, running or available all year or in every season, or that the experience is the same in every season. Keep only what is closed, seasonal or reduced. If a whole sentence only said that, delete it.' },
  { id: 'offers', label: '"offer" for what a place has', kind: 'review', scope: 'all', source: '\\boffer(s|ing)?\\b', ask: 'An occasional "offer" is fine, depending on the interest, but do not lean on it to say what a place, town, region, market, restaurant or season has. Vary the verbs: specializes in, is known for, has, serves, shows, hosts, features.' },
  { id: 'promo', label: 'promotional words', kind: 'fix', scope: 'all', source: 'boasts?|world[- ]class|unparalleled|stunning|incredible|spectacular|breathtaking|paradise(?! island)|unforgettable|legendary|teeming|thriving|must-see|hidden gem|bucket[- ]list', ask: 'Remove promotional words such as boasts, world-class, unparalleled, stunning, incredible, spectacular, breathtaking, paradise, unforgettable, legendary, teeming, thriving, must-see, hidden gem and bucket-list; say plainly what is there.' },
  { id: 'contrast', label: 'contrast framings', kind: 'fix', scope: 'all', source: 'evolved (far )?beyond|more than just|not just|goes beyond|beyond just', ask: 'Remove contrast framings such as "evolved far beyond", "more than just", "not just", "goes beyond". Say plainly what is there.' },
  { id: 'units', label: 'non-US units or spelling', kind: 'fix', scope: 'all', source: '\\b\\d+\\s?(km|kilomet\\w+|meters?|°C|celsius)\\b|colour|(?<!financial )centre|neighbour|favour', ask: 'Use US units and American spelling only (miles, feet, degrees Fahrenheit; color, center, neighbor).' },
  { id: 'thisInterest', label: '"this interest" in the text', kind: 'fix', scope: 'all', source: 'for this interest|this interest', ask: 'Never write "for this interest" or "this interest". Name the thing itself.' },
  { id: 'marketing', label: 'marketing claims about why something is good', kind: 'review', scope: 'all', source: 'driven by (local )?\\w+ water|the perfect (pairing|match|spot)|like nowhere else|second to none', ask: 'State what is there instead of why it is good.' },
  // Stargazing only (9 Nov 2026): the moon is the same everywhere and changes yearly, so it is not a fact about a place; measured figures and jargon stay out of the text.
  { id: 'moon', label: 'the moon (not a fact about a place)', kind: 'fix', scope: 'sky', source: '\\bmoon(light|lit|s)?\\b|\\blunar\\b', ask: 'Remove every mention of the moon, moon phases and moonlight.' },
  { id: 'bortle', label: 'Bortle jargon', kind: 'fix', scope: 'sky', source: 'bortle', ask: 'Do not use the word Bortle; say how dark the sky is in plain words (very dark, dark, bright).' },
  { id: 'figures', label: 'measured figures pasted into the text (hours of darkness, percent cloud)', kind: 'fix', scope: 'sky', source: '\\d+(\\.\\d+)?\\s*(to|-|\u2013)\\s*\\d+(\\.\\d+)?\\s*(hours|percent|%)|\\d+(\\.\\d+)?\\s*(percent|%)|\\d+(\\.\\d+)?\\s+hours of (true )?dark|\\b(\\d+|six|seven|eight|nine|ten|eleven|twelve|thirteen)\\s+hours\\b', ask: 'Describe cloud and darkness in words (mostly clear, very short nights, the sky never gets fully dark); do not quote percentages or hours of darkness.' },
  // 13 Nov 2026, from the owner's notes on the practice batch of four (applies to every interest).
  { id: 'accessibleFiller', label: 'says something "remains accessible" or "fully accessible" when nothing could have closed it', kind: 'review', scope: 'all', source: '\\bfully accessible\\b|\\bremains? (fully )?(accessible|open)\\b', ask: 'Do not say something is accessible or open unless a closure or a closed route is the point. A hotel pool or a viewpoint does not need to be called accessible.' },
  { id: 'notKnownFor', label: 'says what the place is NOT ("rather than natural landscapes", "not known for", "entirely urban")', kind: 'fix', scope: 'all', source: '\\b(rather than|not known for|isn[\u2019\']t known|is not known|not defined by|no natural|entirely (urban|aquatic|artificial|man-made))\\b', ask: 'Say only what the place IS known for. Do not say what it is not or what kind of place it is not: readers understand that a city is not known for natural landscapes.' },
  { id: 'lacks', label: 'spells out what the place lacks', kind: 'review', scope: 'all', source: '\\b(lacks?|lacking|has no|does not have|without any)\\b', ask: 'Do not spell out what the place lacks when what it has already implies it (a desert resort town described by its pools does not need to say it has no beach).' },
  // 18 Nov 2026, Scenic Landscapes: the place's scenery treated as an entity with its own reputation. "Northern Ireland's scenery is known for its dramatic coastline" reads oddly; when we think of a place we already think of its scenery, so the place is the subject ("Northern Ireland is known for ...").
  { id: 'sceneryKnownFor', label: 'makes the scenery itself the subject with a reputation ("X\u2019s scenery is known for ...") instead of the place', kind: 'fix', scope: 'casual', source: '\\b(scenery|landscapes?|views?)\\b[^.]{0,50}?\\b(is|are)\\s+(known|famous|renowned|celebrated)\\b', ask: 'Make the place the subject, not its scenery. Write "Northern Ireland is known for its dramatic coastline", never "Northern Ireland\u2019s scenery is known for its dramatic coastline" or "The landscape is known for ...". When we think of a place we already think of its scenery.' },
  // 18 Nov 2026, Monterey & Big Sur: "Inland, the scenery shifts to dense groves of coastal redwoods and the rocky coves of Point Lobos" put a seaside cove inland.
  { id: 'inlandCoast', label: 'a sentence about the inland that also names coast features (coves, beaches, shore, surf)', kind: 'review', scope: 'all', source: '\\binland\\b[^.]{0,80}\\b(coves?|beach(es)?|shores?|seashores?|coastline|sea cliffs?|surf|harbou?rs?|lagoons?|tidal)\\b', ask: 'Read the sentence again: something on the coast cannot be inland. Put coastal features in their own clause and say where they are.' },
  { id: 'interestNamed', label: 'names a light interest outright ("sunbathing", "scenic landscapes") instead of letting it be implied', kind: 'fix', scope: 'casual', source: '\\bsunbath\\w*|\\bscenic landscapes?\\b', ask: 'Sunbathing and scenery are light, casual pleasures, not sports or serious pursuits. Never write sunbathing, sunbathe or sunbather (or "scenic landscapes"), and never build a verdict on the name ("too cold for sunbathing", "marginal sunbathing weather", "a premier destination for sunbathing"). Describe the sun, the heat, the pools, the beaches or the view directly and let the reader infer the rest. Example: "Highs only reach the 50s and low 60s, though the days are lengthening."' },
  { id: 'trueNight', label: '"true night" or "true darkness" (not a defined term)', kind: 'review', scope: 'sky', source: '\\btrue (night|darkness)\\b', ask: '"True night" is not a defined term. Prefer plain words ("fully dark", "the sky never gets fully dark"); "astronomical darkness" (sun more than 18 degrees below the horizon) is fine once, glossed in plain words.' },
  // 16 Nov 2026, owner's Badlands note: a closing sentence that only restates the overview. Heuristic, so it lists candidates for a person to judge.
  { id: 'recap', label: 'overview ends with a sentence that only recaps what it already said (3+ sentences)', kind: 'review', scope: 'all', source: '', ask: 'Remove a final sentence that only summarizes or restates the sentences before it ("The landscapes range from X to Y"). End on the last new fact.' },
  // 16 Nov 2026, owner's notes on Ladakh: say nothing about when in the evening the Milky Way can be seen (the band is up all night; only the bright core comes and goes). Stargazing only.
  { id: 'milkyWayTime', label: 'says when in the evening or night the Milky Way is visible', kind: 'fix', scope: 'sky', source: 'milky way[^.]{0,80}\\b(evening|small hours|midnight|dawn|early (in the )?night)\\b|\\b(early (in the )?(evening|night)|evening|small hours|midnight|dawn)\\b[^.]{0,60}milky way', ask: 'Mention the Milky Way only as its bright core being well placed that month or not up at night. Never say when in the evening or night it can be seen.' },
  // Heuristics for the drinks interests: they list candidates for a person to read.
  { id: 'rangeOpener', label: 'first sentence surveys the whole range (two or more drink families)', kind: 'review', scope: 'drinks', source: '' },
  { id: 'mixedSentence', label: 'two drink families in one sentence joined by or / while / alongside', kind: 'review', scope: 'drinks', source: '' },
];

const FAMILIES: Record<string, RegExp> = {
  wine: /\b(wines?|vineyards?|wineries|winery|cellar doors?|grapes?|cava|sherry|port|champagne|prosecco|malbec|sake|vermouth|rosé|bodegas?|vendimia)\b/i,
  beer: /\b(beers?|brew\w*|ales?|lagers?|stouts?|pilsners?|taprooms?|ipas?|cider\w*|bocks?)\b/i,
  spirits: /\b(whisk(e)?y|whiskies|rum|gin|vodka|spirits?|distill\w*|liqueurs?|brandy|mezcal|tequila|baijiu|aquavit|grappa|pisco|cachaça|jenever|absinthe|sotol|kirsch\w*)\b/i,
};
const families = (s: string) => Object.entries(FAMILIES).filter(([, rx]) => rx.test(s)).map(([k]) => k);
const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).filter(Boolean);

const STOP = new Set('the a an and or of in on at to for with from by is are was were be been this that these those its their it as into over under than then there here have has had can may will which while where when also such more most some many each both between across through along around above below near'.split(' '));
const stem = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5);
const contentStems = (t: string) => t.split(/\s+/).map(stem).filter((w) => w.length >= 4 && !STOP.has(w));
const RECAP_OPENER = /^(overall|together|in short|all told|in sum|in all|taken together|altogether)\b|^(the )?(landscapes?|scenery|scenes?|terrain|views?|region|area|settings?|park|country(side)?)\b[^.]{0,40}\b(range[sd]?|vary|varies|varied|span[s]?|mix(es)?|blend[s]?|combine[s]?|contrast[s]?|alternate[s]?)\b/i;
/** True when the last of three or more sentences only summarizes: it opens like a summary ("The landscapes range from...", "Overall,...") or mostly repeats earlier words. */
/** 18 Nov 2026 (W/S05): a Scenic cell that scores the same in all twelve months claims neither the look of the place nor the comfort of seeing it ever changes. She challenged Death Valley, Dubai, Kruger, London and Churchill, all flat, each of which changes with heat, green season or snow. */
export function flatAllYear(scores: number[]): boolean {
  return scores.length === 12 && scores[0] > 0 && scores.every((v) => v === scores[0]);
}

export function endsWithRecap(overview: string): boolean {
  const ss = sentences(overview); if (ss.length < 3) return false;
  const last = ss[ss.length - 1]; if (RECAP_OPENER.test(last.trim())) return true;
  const earlier = new Set(ss.slice(0, -1).flatMap(contentStems)); const mine = contentStems(last);
  return mine.length >= 4 && mine.filter((w) => earlier.has(w)).length / mine.length >= 0.6;
}

/** Rule ids broken by one overview (and blurbs). Heuristic review rules look at the overview only. */
export function scanText(overview: string, blurbs: string[], opts: { drinks?: boolean; sky?: boolean; casual?: boolean } = {}): string[] {
  const hits: string[] = []; const all = [overview, ...blurbs];
  for (const r of TEXT_RULES) {
    if (!r.source) continue; if ((r.scope === 'drinks' && !opts.drinks) || (r.scope === 'sky' && !opts.sky) || (r.scope === 'casual' && !opts.casual)) continue;
    const rx = new RegExp(r.source, 'i'); if (all.some((t) => rx.test(t))) hits.push(r.id);
  }
  if (endsWithRecap(overview)) hits.push('recap');
  if (opts.drinks) {
    const ss = sentences(overview);
    if (ss[0] && families(ss[0]).length >= 2) hits.push('rangeOpener');
    if (ss.some((s) => families(s).length >= 2 && /\b(or|while|alongside|whereas)\b/i.test(s))) hits.push('mixedSentence');
  }
  return hits;
}

// ---- Month-blurb structure (13 Nov 2026) ----------------------------------------------------------------------------------------------------------
// Rules from the owner's review of the practice batch of four, checked on the months a blurb covers and the scores of those months.
export interface BlurbInput { months: number[]; text: string }
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SEASON_WORDS = /\b(spring|summer|autumn|fall|winter|dry season|wet season|rainy season|monsoon|shoulder|months?)\b/i;

/** The month numbers (1 to 12) a text names. "May" counts only when it reads as the month (after in, from, through, until, during, by, to, and, or, of, early, late, mid-). */
export function monthsNamed(text: string): number[] {
  const out = new Set<number>();
  MONTH_NAMES.forEach((m, i) => { if (m !== 'May' && new RegExp(`\\b${m}\\b`).test(text)) out.add(i + 1); });
  MONTH_ABBR.forEach((m, i) => { if (m !== 'May' && new RegExp(`\\b${m}\\.?(?=[\\s,;)]|$)`).test(text)) out.add(i + 1); });
  if (/\b(?:in|from|through|until|during|by|to|and|or|of|early|late|mid-)\s+May\b|\bMay\s+(?:through|to|and|or|until)\b/i.test(text) && /May/.test(text)) out.add(5);
  return [...out];
}

/** True when the months run in one unbroken stretch of the calendar (December and January count as neighbors). */
export function isContiguous(months: number[]): boolean {
  const set = new Set(months); if (set.size <= 1 || set.size >= 12) return true;
  const starts = months.filter((m) => !set.has(((m + 10) % 12) + 1));
  return starts.length === 1;
}

/** The months in calendar order starting from the first month of the stretch (December before January). */
function orderedMonths(months: number[]): number[] {
  const set = new Set(months); const start = months.find((m) => !set.has(((m + 10) % 12) + 1)) ?? Math.min(...months);
  return Array.from({ length: months.length }, (_, i) => ((start - 1 + i) % 12) + 1).filter((m) => set.has(m));
}

/** True when the values only climb or only fall (ties allowed) in calendar order: a curve a reader would expect. */
function isSmooth(v: number[]): boolean {
  const up = v.every((x, i) => i === 0 || x >= v[i - 1] - 0.05), down = v.every((x, i) => i === 0 || x <= v[i - 1] + 0.05);
  return up || down;
}

/**
 * Which structure rules a set of month blurbs breaks (ids):
 *  otherMonth     a blurb names a month it does not cover ("one-month test": someone going in one month of the group must not be made to read about another)
 *  partialMonths a blurb names some of its own months but not the whole stretch ("from May to August" inside an April to October blurb): the detail belongs to a blurb of its own
 *  disparateNamed months that are not neighbors are grouped, but the blurb names a month or a season (only one simple blurb true of both, naming neither, works)
 *  groupTalk      a blurb talks about its group instead of speaking as if for one month: plural "months" ("these are the wettest months"), a month named inside a multi-month blurb, "this stretch"
 *                 (owner, 14 Nov 2026: it ruins the illusion that the text is written for exactly the month the visitor picked)
 *  nonNeighbors   a blurb groups months that are not neighbors (owner, 13 Nov 2026: groups are runs of neighboring months only)
 *  wideGroup      the scores inside one blurb differ by more than 1.5 points: the group MUST be split
 *  splitConsider  they differ by more than 0.5 (owner, 13 Nov 2026: 'above .5 consider splitting, above 1.5 must split'). Judge by how expected the curve is: a smooth climb or fall of up to 1.0
 *                 across the group reads as natural and is not flagged; a bump, a dip or a swing past 1.0 could confuse a reader, so split it
 *  (Last digits are NOT a per-place rule: the owner's rule is an even spread across the batch and the catalog, tested by digitReport in src/lib/gemini/even-tenths.ts.)
 */
/** The ids scanStructure can return, listed once so the standards registry can be checked against them. */
// ---- Stargazing: wording that must follow the sky (16 Nov 2026, owner's notes on Ladakh and Svalbard in Practice Batch Three) --------------------------
export const SKY_RULE_IDS = ['nightLengthNearEquator', 'skyBandMix', 'neverDarkOverstated'] as const;
const NIGHT_LENGTH = /\b(nights?|darkness)\b[^.]{0,30}\b(short|shorter|shorten\w*|long|longer|lengthen\w*)\b|\b(short|shorter|long|longer)\s+nights?\b|\blength of the night\b/i;
const SEATTLE_LATITUDE = 47.5;
/** The sky a month has, from the sun's lowest height at night: 0 fully dark, 1 most stars show, 2 a few stars show, 3 twilight all night (no star), 4 sun up all night (no star). */
export function skyBand(lowestSunDegrees: number): number {
  return lowestSunDegrees < -18 ? 0 : lowestSunDegrees < -12 ? 1 : lowestSunDegrees < -6 ? 2 : lowestSunDegrees < 0 ? 3 : 4;
}
/**
 * Stargazing checks that need the place's latitude:
 *  nightLengthNearEquator  talks about long or short nights for a place closer to the equator than Seattle (about 47.5 degrees)
 *  skyBandMix              a blurb covers months with different skies (fully dark, most stars, a few stars, twilight all night, sun up all night)
 *  neverDarkOverstated     says the sky "never gets fully dark" for months where it is fully dark or most stars still show
 */
export function scanSky(overview: string, blurbs: BlurbInput[], latitude: number): string[] {
  const hits = new Set<string>();
  if (Math.abs(latitude) < SEATTLE_LATITUDE && [overview, ...blurbs.map((b) => b.text)].some((t) => NIGHT_LENGTH.test(t))) hits.add('nightLengthNearEquator');
  const bands = lowestSunAltitudeByMonth(latitude).map(skyBand);
  for (const b of blurbs) {
    const mine = new Set(b.months.map((m) => bands[m - 1]));
    if (mine.size > 1) hits.add('skyBandMix');
    if ([...mine].every((x) => x <= 1) && /never (gets? |get )?(fully |completely )?dark|never fully dark/i.test(b.text)) hits.add('neverDarkOverstated');
  }
  return [...hits];
}

export const STRUCTURE_RULE_IDS = ['otherMonth', 'partialMonths', 'disparateNamed', 'nonNeighbors', 'groupTalk', 'wideGroup', 'splitConsider', 'sequenceWords'] as const;
/** Words that describe something changing across the months of a shared blurb (owner, 17 Nov 2026, Bordeaux: "eventually turning gold and red by early autumn" inside an April to October blurb). */
const SEQUENCE_WORDS = /\b(eventually|gradually|slowly|toward the end|towards the end|later in|by (?:early|mid|late)[- ]?(?:spring|summer|autumn|fall|winter|season|month|week)|as the (?:season|summer|spring|autumn|fall|winter|month|week)s? (?:progress|advance|go on|goes on|wear on|wears on|continue)\w*)\b/i;

export function scanStructure(blurbs: BlurbInput[], scores?: number[]): string[] {
  const hits = new Set<string>();
  for (const b of blurbs) {
    const named = monthsNamed(b.text);
    if (named.some((m) => !b.months.includes(m))) hits.add('otherMonth');
    else if (named.length && b.months.length > 1) {
      const order = orderedMonths(b.months); const pos = named.map((m) => order.indexOf(m));
      if (Math.min(...pos) > 0 || Math.max(...pos) < order.length - 1) hits.add('partialMonths');
    }
    if (/\bmonths\b|\b(this|that|the same) (stretch|period|season|time of year)\b|\bthe (rest|remainder) of the (year|season)\b/i.test(b.text) || (b.months.length > 1 && named.length > 0)) hits.add('groupTalk');
    if (b.months.length > 1 && SEQUENCE_WORDS.test(b.text)) hits.add('sequenceWords');
    if (!isContiguous(b.months)) hits.add('nonNeighbors');
    if (!isContiguous(b.months) && (named.length > 0 || SEASON_WORDS.test(b.text))) hits.add('disparateNamed');
    if (scores && b.months.length > 1) { const v = b.months.map((m) => scores[m - 1]).filter((x) => typeof x === 'number'); if (v.length > 1) { const spread = Math.max(...v) - Math.min(...v); if (spread > 1.5 + 1e-9) hits.add('wideGroup'); else if (spread > 0.5 + 1e-9 && !(spread <= 1.0 + 1e-9 && isSmooth(orderedMonths(b.months).map((m) => scores[m - 1])))) hits.add('splitConsider'); } }
  }
  return [...hits];
}
