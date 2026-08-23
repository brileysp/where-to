/* ---------------------------------------------------------------------
   Where To? — destination + seasonality dataset (v3)
   -----------------------------------------------------------------
   Three control types:
   - PERSONAS: quick-start bundles of slider weights (not scored fields)
   - SLIDERS: 27 atomic interests, weighted 0-10, additive scoring
   - BAND_DIMENSIONS: "Open To" — Budget, Weather, Vibe, Physical —
     multi-select bands (not weighted; a destination-month either
     matches a selected band or takes a penalty)

   Each destination keeps the original monthly "seasonal facts" (dry,
   wet, hot, cold, peak, low, swimHazard, shopClosures, hikingBest/
   Worst, wildlifePeak/Closed, birdingPeak, inaccessible). New sliders
   REUSE those same facts via a formula-group (see FORMULA_GROUP)
   rather than needing their own per-slider override lists — e.g.
   "Diving & Snorkeling" reuses the same dry/wet/swimHazard logic as
   "Ocean Swimming".

   General-knowledge based, not live data — see index.html panel note.
--------------------------------------------------------------------- */

// ---- Sliders (Interests) ---------------------------------------------------
// group = UI section. formula = which existing derivation pattern this
// slider reuses (see deriveDestinationScores). base value lives on each
// destination's `base` object, keyed by slider key.
const SLIDERS = [
  // Nature & Wildlife
  { key: 'birding',   label: 'Birding',                 icon: '🦜', group: 'Nature & Wildlife', formula: 'birding' },
  { key: 'wildlife',  label: 'Wildlife Photography',     icon: '📸', group: 'Nature & Wildlife', formula: 'wildlife' },
  { key: 'hiking',    label: 'Hiking',                   icon: '🥾', group: 'Nature & Wildlife', formula: 'hiking' },
  { key: 'scenic',    label: 'Scenic Landscapes',        icon: '🏞️', group: 'Nature & Wildlife', formula: 'hiking' },
  { key: 'stargazing',label: 'Stargazing',               icon: '✨', group: 'Nature & Wildlife', formula: 'culture' },
  { key: 'fishing',   label: 'Fishing',                  icon: '🎣', group: 'Nature & Wildlife', formula: 'hiking' },
  // Water & Relaxation
  { key: 'sunbathing',label: 'Sunbathing',               icon: '☀️', group: 'Water & Relaxation', formula: 'sun' },
  { key: 'swimming',  label: 'Ocean Swimming',           icon: '🌊', group: 'Water & Relaxation', formula: 'swim' },
  { key: 'diving',    label: 'Diving & Snorkeling',      icon: '🤿', group: 'Water & Relaxation', formula: 'swim' },
  { key: 'surfing',   label: 'Surfing',                  icon: '🏄', group: 'Water & Relaxation', formula: 'swim' },
  { key: 'sailing',   label: 'Sailing & Boating',        icon: '⛵', group: 'Water & Relaxation', formula: 'swim' },
  { key: 'spa',       label: 'Spa & Wellness',           icon: '💆', group: 'Water & Relaxation', formula: 'food' },
  // Culture & Food
  { key: 'museums',   label: 'Museums & Historic Sites', icon: '🏛️', group: 'Culture & Food', formula: 'culture' },
  { key: 'architecture', label: 'Architecture',          icon: '🏰', group: 'Culture & Food', formula: 'culture' },
  { key: 'festivals', label: 'Festivals & Traditions',   icon: '🎉', group: 'Culture & Food', formula: 'culture' },
  { key: 'finedining',label: 'Fine Dining',              icon: '🍽️', group: 'Culture & Food', formula: 'food' },
  { key: 'streetfood',label: 'Street Food',              icon: '🌮', group: 'Culture & Food', formula: 'food' },
  { key: 'nightlife', label: 'Nightlife',                icon: '🍸', group: 'Culture & Food', formula: 'food' },
  { key: 'winetasting', label: 'Wine Tasting',           icon: '🍷', group: 'Culture & Food', formula: 'food' },
  { key: 'shopping',  label: 'Shopping',                 icon: '🛍️', group: 'Culture & Food', formula: 'shopping' },
  // Active & Adventure
  { key: 'cycling',   label: 'Cycling',                  icon: '🚴', group: 'Active & Adventure', formula: 'hiking' },
  { key: 'snowsports',label: 'Snow Sports',              icon: '🎿', group: 'Active & Adventure', formula: 'snow' },
  { key: 'adventure', label: 'Adventure Sports',         icon: '🪂', group: 'Active & Adventure', formula: 'hiking' },
  { key: 'roadtrip',  label: 'Road-Tripping',            icon: '🚗', group: 'Active & Adventure', formula: 'hiking' },
  { key: 'golf',      label: 'Golf',                     icon: '⛳', group: 'Active & Adventure', formula: 'hiking' },
  // Value
  { key: 'deals',     label: 'Low-Season Deals',         icon: '💸', group: 'Value', formula: 'deals' },
  { key: 'crowds',    label: 'Avoiding Crowds',          icon: '🧘', group: 'Value', formula: 'crowds' },
];

const SLIDER_GROUPS = ['Nature & Wildlife', 'Water & Relaxation', 'Culture & Food', 'Active & Adventure', 'Value'];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ---- Personas ---------------------------------------------------------------
// primary: sliders shown by default with a real weight; every other slider
// defaults to a low neutral weight but is fully visible/adjustable under
// "show all sliders".
const NEUTRAL_WEIGHT = 2;
function buildWeights(primary) {
  const w = {};
  SLIDERS.forEach(s => (w[s.key] = NEUTRAL_WEIGHT));
  Object.assign(w, primary);
  return w;
}

const PERSONAS = [
  {
    id: 'naturalist', name: 'The Naturalist', icon: '🦜',
    blurb: 'Wildlife, birds, and wild places — timing matters more than anything else.',
    primary: ['birding','wildlife','hiking','scenic','stargazing','fishing','diving','crowds'],
    weights: buildWeights({ birding: 9, wildlife: 9, hiking: 6, scenic: 6, stargazing: 5, fishing: 4, diving: 4, crowds: 7, deals: 5 }),
  },
  {
    id: 'sunwater', name: 'Sun & Water', icon: '🏖️',
    blurb: 'Beaches, warm water, and slowing down.',
    primary: ['sunbathing','swimming','diving','surfing','sailing','spa','deals','crowds'],
    weights: buildWeights({ sunbathing: 9, swimming: 9, diving: 6, surfing: 6, sailing: 5, spa: 6, deals: 5, crowds: 4 }),
  },
  {
    id: 'connoisseur', name: 'The Connoisseur', icon: '🍽️',
    blurb: 'Museums, markets, and meals worth planning a trip around.',
    primary: ['museums','finedining','streetfood','architecture','festivals','nightlife','shopping','winetasting'],
    weights: buildWeights({ museums: 8, finedining: 9, streetfood: 7, architecture: 7, festivals: 6, nightlife: 7, shopping: 6, winetasting: 5 }),
  },
  {
    id: 'active', name: 'Active & Outdoors', icon: '🚵',
    blurb: 'Trails, adrenaline, and a reason to be outside all day.',
    primary: ['hiking','cycling','adventure','snowsports','roadtrip','scenic','fishing','crowds'],
    weights: buildWeights({ hiking: 9, cycling: 7, adventure: 8, snowsports: 5, roadtrip: 6, scenic: 7, fishing: 4, crowds: 5 }),
  },
];

// ---- "Open To" band dimensions -----------------------------------------------
const BAND_DIMENSIONS = [
  { key: 'budget', label: 'Budget & Comfort', icon: '💳', bands: [
    { key: 'basic', label: 'Basic / Budget' }, { key: 'comfortable', label: 'Comfortable' },
    { key: 'highend', label: 'High-End' }, { key: 'luxury', label: 'Luxury' } ] },
  { key: 'weather', label: 'Weather', icon: '🌡️', bands: [
    { key: 'cold', label: 'Cold' }, { key: 'cool', label: 'Cool' },
    { key: 'warm', label: 'Warm' }, { key: 'hot', label: 'Hot' } ] },
  { key: 'vibe', label: 'Social Vibe', icon: '🎭', bands: [
    { key: 'secluded', label: 'Secluded & Quiet' }, { key: 'easygoing', label: 'Easygoing & Low-Key' },
    { key: 'lively', label: 'Lively & Social' }, { key: 'highenergy', label: 'High-Energy & Nightlife' } ] },
  { key: 'physical', label: 'Physical Demand', icon: '💪', bands: [
    { key: 'easy', label: 'Easy for Anyone' }, { key: 'moderate', label: 'Moderate' },
    { key: 'active', label: 'Active' }, { key: 'challenging', label: 'Challenging' } ] },
];

function allBandsSelected() {
  const sel = {};
  BAND_DIMENSIONS.forEach(dim => (sel[dim.key] = dim.bands.map(b => b.key)));
  return sel;
}

// ---- Weather-band derivation --------------------------------------------------
// Every destination gets one `climate` archetype; combined with its existing
// hot/cold/dry/wet month arrays, this derives a Cold/Cool/Warm/Hot band per
// month without hand-typing 1,200 individual values.
function deriveWeatherBand(d, m) {
  const hot = (d.hot || []).includes(m);
  const cold = (d.cold || []).includes(m);
  switch (d.climate) {
    case 'tropical': return hot ? 'hot' : 'warm';
    case 'desert': return hot ? 'hot' : cold ? 'cool' : 'warm';
    case 'mediterranean': return hot ? 'hot' : cold ? 'cool' : 'warm';
    case 'temperate': return hot ? 'warm' : cold ? 'cold' : 'cool';
    case 'highland': return cold ? 'cold' : 'cool';
    case 'polar': return cold ? 'cold' : 'cool';
    default: return 'warm';
  }
}

// ---- Month-specific blurb ---------------------------------------------------
// Generates one sentence like "May in Namibia is early in the dry season,
// with warm temperatures, and wildlife viewing is at its best." — built
// entirely from the same dry/wet/hot/cold/peak/wildlifePeak/birdingPeak
// month-arrays that already drive scoring and badges, so it's always
// consistent with them and scales to all 100 destinations x 12 months
// without hand-authoring 1,200 sentences.
const prevMonth = m => (m === 1 ? 12 : m - 1);
const nextMonth = m => (m === 12 ? 1 : m + 1);

/**
 * Where month `m` falls within the CONTIGUOUS run of `arr` that contains
 * it (not `arr`'s raw index) — some destinations have multi-segment
 * seasons (e.g. two separate dry spells in one year), so this walks
 * outward from `m` to find just the segment it's actually part of,
 * wrapping across the Dec->Jan boundary correctly.
 */
function seasonPosition(arr, m) {
  if (!Array.isArray(arr) || !arr.length) return null;
  const set = new Set(arr);
  if (!set.has(m)) return null;
  // A destination where the "season" covers all 12 months (e.g. a desert
  // that's dry year-round) has no meaningful start/middle/end to find —
  // walking outward would just cycle forever, so bail out early. Null
  // signals "no position" the same as an out-of-season month; the
  // year-round case gets its own sentence shape in generateMonthlyBlurb.
  if (set.size >= 12) return null;
  let start = m, end = m;
  let guard = 0;
  while (set.has(prevMonth(start)) && guard < 11) { start = prevMonth(start); guard++; }
  guard = 0;
  while (set.has(nextMonth(end)) && guard < 11) { end = nextMonth(end); guard++; }
  const len = start <= end ? end - start + 1 : (12 - start + 1) + end;
  const idx = m >= start ? m - start : (12 - start) + m;
  if (len === 1) return 'the only month of';
  if (idx === 0) return 'the start of';
  if (idx === len - 1) return 'the tail end of';
  if (idx <= Math.floor(len / 3)) return 'early in';
  if (idx >= Math.ceil((2 * len) / 3) - 1) return 'late in';
  return 'the heart of';
}

/** Which named season (if any) headlines month `m`, and the array to position within. */
function seasonDescriptor(d, m) {
  const dry = has(d.dry, m), wet = has(d.wet, m), hot = has(d.hot, m), cold = has(d.cold, m);
  if (dry && hot) return { arr: d.dry, phrase: 'the hot, dry season' };
  if (dry && cold) return { arr: d.dry, phrase: 'the cool, dry season' };
  if (wet && hot) return { arr: d.wet, phrase: 'the hot, wet season' };
  if (wet && cold) return { arr: d.wet, phrase: 'the cold, wet season' };
  if (dry) return { arr: d.dry, phrase: 'the dry season' };
  if (wet) return { arr: d.wet, phrase: 'the wet season' };
  if (cold) return { arr: d.cold, phrase: 'the cold season' };
  if (hot) return { arr: d.hot, phrase: 'the hot season' };
  return null;
}

const WEATHER_BAND_WORD = { cold: 'cold', cool: 'mild', warm: 'warm', hot: 'hot' };

// A stable, deterministic (not random-per-render) way to give same-pattern
// destinations different wording: hash the destination id into a pick
// among a few equivalent phrasings, so June-dry-peak in a highland climate
// and June-dry-peak in a polar one — or even two destinations that share
// the SAME climate — don't come out byte-identical just because their
// flags happen to match.
function hashSeed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function pickVariant(arr, seed) { return arr[hashSeed(seed) % arr.length]; }

// Same weather BAND (cold/cool/warm/hot) reads differently depending on
// what kind of place it is — "warm" means something different in the
// tropics than at altitude. This is what actually fixes Lofoten (polar)
// vs Cusco (highland) landing on identical text: they share a "mild" band
// but not a climate, so they now diverge here.
const CLIMATE_TEMP_PHRASE = {
  tropical:      { cold: 'cool for the tropics', cool: 'pleasantly cool', warm: 'warm and humid', hot: 'hot and humid' },
  desert:        { cold: 'cold once the sun drops', cool: 'cool and dry', warm: 'warm and dry', hot: 'scorching and dry' },
  mediterranean: { cold: 'cool and crisp', cool: 'mild', warm: 'warm and sunny', hot: 'hot and dry' },
  temperate:     { cold: 'cold', cool: 'cool and changeable', warm: 'mild', hot: 'warm' },
  highland:      { cold: 'cold, with thin mountain air', cool: 'crisp at altitude', warm: 'mild by day, cold at night', hot: 'warm for the altitude' },
  polar:         { cold: 'bitterly cold', cool: 'cold', warm: 'cool by Arctic standards', hot: 'as warm as it gets up here' },
};
function climateTempPhrase(climate, band) {
  const row = CLIMATE_TEMP_PHRASE[climate];
  return (row && row[band]) || WEATHER_BAND_WORD[band] || 'mild';
}

const SHOULDER_PHRASE = {
  tropical: 'a quieter, in-between month',
  desert: 'a quieter shoulder month',
  mediterranean: 'a quieter shoulder month',
  temperate: 'a transitional month between seasons',
  highland: 'a quieter month between the main seasons',
  polar: 'a quieter month before the extremes set in',
};

const LOW_TAIL_VARIANTS = [
  'a good time for value and thinner crowds',
  'quieter and easier on the budget',
  'fewer visitors and better deals than usual',
];

/**
 * Crowds & price — deliberately NOT interest-specific (unlike the old
 * wildlife/birding clause this replaced): whether a month is peak or low
 * season affects everyone's trip, regardless of what they came to do.
 *
 * The peak side is intensity-aware (see peakBadge's doc comment for why —
 * same d.peakIntensity field drives both). Deliberately understated even
 * at 'extreme': just "peak crowds and prices," not dramatized language —
 * the fact itself is the point, not the adjectives. 'mild' peaks aren't
 * mentioned at all, matching the badge behavior.
 */
function crowdPriceClause(d, m) {
  const peak = has(d.peak, m), low = has(d.low, m);
  if (peak) {
    const intensity = d.peakIntensity || 'moderate';
    if (intensity === 'extreme') return ', with peak crowds and prices';
    if (intensity === 'moderate') return ', with higher tourism volume and prices';
    return ''; // mild
  }
  if (!low) return '';
  const yearRound = new Set(d.low).size >= 12;
  const position = yearRound ? null : seasonPosition(d.low, m);
  const tail = pickVariant(LOW_TAIL_VARIANTS, d.id + ':low');
  return yearRound
    ? `, and it's low season year-round — ${tail}`
    : `, and ${position} low season — ${tail}`;
}

/**
 * Practical "don't get blindsided" facts — closures and hazards, not
 * activity endorsements. Only the single most severe one shows, in
 * priority order, rather than stacking several caveats onto one card.
 */
function accessCaveatClause(d, m) {
  if (has(d.inaccessible, m)) return ' <span class="blurb-caveat">Not accessible this month.</span>';
  if (has(d.wildlifeClosed, m)) return ' <span class="blurb-caveat">The wildlife reserve/park is closed this month.</span>';
  if (has(d.swimHazard, m)) return ' <span class="blurb-caveat">Storm or hazard risk in the water this month.</span>';
  if (d.shopClosures && has(d.low, m)) return ' <span class="blurb-caveat">Some shops, hotels & restaurants close for the season.</span>';
  return '';
}

/**
 * A destination-specific, non-weather headline event — the Great
 * Migration, the Serengeti calving season, Churchill's polar bears,
 * aurora season in Iceland, lavender bloom in Provence, and so on.
 * Unlike everything else in this file, these can't be derived from the
 * generic dry/wet/hot/cold/peak/low vocabulary — they're hand-authored
 * per destination in `d.specialSeasons` because the "why now" is a real,
 * named thing (a migration, a bloom, a festival) rather than a climate
 * pattern. Most destinations don't have one; that's expected, not a gap.
 */
function specialSeasonClause(d, m) {
  if (!Array.isArray(d.specialSeasons)) return '';
  const hit = d.specialSeasons.find(s => has(s.months, m));
  if (!hit) return '';
  return ` <span class="blurb-special">${hit.text}</span>`;
}

function generateMonthlyBlurb(d, m) {
  const monthName = MONTH_NAMES[m - 1];

  // d.monthlyWeather (pilot batch, not yet on every destination) is real,
  // researched per-destination-per-month text — replaces the generated
  // climate-archetype + season-position phrasing below, which by design
  // draws from a small shared phrase bank and reads near-identically
  // across destinations that happen to share a climate. Everything else
  // (crowds, access caveats, special seasons) is already destination-
  // specific and stays the same either way.
  const handWritten = Array.isArray(d.monthlyWeather) ? d.monthlyWeather[m - 1] : null;

  let seasonClause, tempClause;
  if (handWritten) {
    seasonClause = handWritten;
    tempClause = '';
  } else {
    const season = seasonDescriptor(d, m);
    const band = deriveWeatherBand(d, m);
    const tempPhrase = climateTempPhrase(d.climate, band);
    const seasonIsYearRound = season && new Set(season.arr).size >= 12;
    seasonClause = seasonIsYearRound
      ? `${season.phrase}, year-round`
      : season
        ? `${seasonPosition(season.arr, m)} ${season.phrase}`
        : (SHOULDER_PHRASE[d.climate] || 'a quieter shoulder month');
    // Skip restating temperature if the season phrase already named it
    // (e.g. "the hot, dry season" already says hot).
    tempClause = season && /hot|cold|cool/.test(season.phrase) ? '' : `, ${tempPhrase}`;
  }

  const crowdClause = crowdPriceClause(d, m);
  const specialClause = specialSeasonClause(d, m);
  const caveatClause = accessCaveatClause(d, m);

  return `${monthName} in ${d.name} is ${seasonClause}${tempClause}${crowdClause}.${specialClause}${caveatClause}`;
}

// ---- Scoring engine --------------------------------------------------------
function clamp10(v) { return Math.max(0, Math.min(10, v)); }
function has(arr, m) { return Array.isArray(arr) && arr.includes(m); }

/**
 * True if `key` is a structurally-absent interest for this destination —
 * never a real, plannable reason to visit in any month (no coastline, no
 * snow terrain, no retail scene, etc.), as opposed to merely scoring low
 * some months. `d.naSliders` is hand-reviewed, not auto-derived from the
 * live score, so it stays stable even if scoring formulas change later.
 */
function isSliderNA(d, key) { return Array.isArray(d.naSliders) && d.naSliders.includes(key); }

function formulaScore(d, m, formula) {
  switch (formula) {
    case 'sun':
      return d.base.sunbathing + (has(d.dry, m) ? 2 : 0) - (has(d.wet, m) ? 4 : 0) - (has(d.hot, m) ? 2 : 0) - (has(d.cold, m) ? 4 : 0);
    case 'swim':
      return null; // handled per-slider below (needs the slider's own base)
    case 'hiking':
      return null;
    case 'culture':
      return null;
    case 'food':
      return null;
    case 'shopping':
      return d.base.shopping + (has(d.peak, m) ? 1 : 0) - (d.shopClosures && has(d.low, m) ? 4 : 0);
    case 'deals':
      return has(d.peak, m) ? 2 : (has(d.low, m) ? 9 : 6);
    case 'crowds':
      return has(d.peak, m) ? 2 : (has(d.low, m) ? 9 : 6);
    default:
      return null;
  }
}

// Deliberately universal only — facts relevant to any traveler regardless
// of their specific interests (weather, crowds/price, access). Interest-
// specific claims (e.g. "great wildlife window") belong in the
// personalized breakdown below the fold, not up here where every visitor
// sees the same badge no matter what they're actually into.
const BADGE_RULES = [
  ['wildlifeClosed', 'Reserve/park closed', 'bad'],
  ['inaccessible',   'Not accessible this month', 'bad'],
  ['swimHazard',     'Storm/hazard risk in the water', 'bad'],
  ['wet',            'Rainy season', 'bad'],
  ['hot',             'Very hot', 'warn'],
  ['cold',            'Very cold', 'warn'],
  ['dry',             'Dry season', 'good'],
  ['low',             'Low season', 'good'],
];

/**
 * "Peak" isn't one thing — Amalfi in August and Cusco in June are both
 * technically peak season, but one is a documented overtourism/price-spike
 * case and the other is just modestly busier than its own rainy season.
 * `d.peakIntensity` ('extreme' | 'moderate' | 'mild') captures which is
 * which, based on real-world knowledge of each named destination — not
 * derivable from any existing flag. Absent = 'moderate' (today's default
 * behavior). 'mild' genuinely isn't flagged at all, matching
 * crowdPriceClause's treatment in generateMonthlyBlurb below.
 */
function peakBadge(d, m) {
  if (!has(d.peak, m)) return null;
  const intensity = d.peakIntensity || 'moderate';
  if (intensity === 'extreme') return { label: 'Peak crowds & prices', tone: 'bad' };
  if (intensity === 'moderate') return { label: 'Higher tourism & prices', tone: 'warn' };
  return null; // mild: don't even flag it
}

function computeBadges(d, m) {
  const out = [];
  BADGE_RULES.forEach(([field, label, tone]) => {
    if (has(d[field], m)) out.push({ label, tone });
  });
  const peak = peakBadge(d, m);
  if (peak) out.push(peak);
  if (d.shopClosures && has(d.low, m)) out.push({ label: 'Some shops, hotels & restaurants closed for the season', tone: 'bad' });
  return out;
}

function deriveDestinationScores(d) {
  const monthly = {};
  SLIDERS.forEach(s => (monthly[s.key] = new Array(12).fill(0)));
  const badges = [];
  const weatherBand = new Array(12);

  for (let m = 1; m <= 12; m++) {
    const idx = m - 1;
    weatherBand[idx] = deriveWeatherBand(d, m);

    if (has(d.inaccessible, m)) {
      SLIDERS.forEach(s => (monthly[s.key][idx] = 0));
      badges[idx] = computeBadges(d, m);
      continue;
    }

    const hikeBestList = d.hikingBest || d.dry;
    const hikeWorstList = d.hikingWorst || [...(d.wet || []), ...(d.hot || []), ...(d.cold || [])];

    SLIDERS.forEach(s => {
      const base = d.base[s.key];
      let v;
      // 'deals'/'crowds' are the only two sliders computed purely from
      // peak/low season flags, with no per-destination base value at all
      // (no destination object defines base.deals or base.crowds, by
      // design) — so the base-undefined bail-out below must not apply to
      // them, or they silently return 0 for every destination/month.
      if (base === undefined && s.formula !== 'deals' && s.formula !== 'crowds') { monthly[s.key][idx] = 0; return; }
      switch (s.formula) {
        case 'sun':
          v = base + (has(d.dry, m) ? 2 : 0) - (has(d.wet, m) ? 4 : 0) - (has(d.hot, m) ? 2 : 0) - (has(d.cold, m) ? 4 : 0);
          break;
        case 'swim':
          v = base + (has(d.dry, m) ? 1 : 0) - (has(d.wet, m) ? 2 : 0) - (has(d.swimHazard, m) ? 5 : 0) - (has(d.cold, m) ? 5 : 0);
          break;
        case 'hiking':
          v = base + (has(hikeBestList, m) ? 3 : 0) - (has(hikeWorstList, m) ? 4 : 0);
          break;
        case 'snow':
          v = base + (has(d.cold, m) ? 3 : 0) - (has(d.dry, m) || has(d.hot, m) ? 2 : 0);
          break;
        case 'culture':
          v = base + (has(d.dry, m) ? 1 : 0) - (has(d.wet, m) ? 2 : 0) - (d.shopClosures && has(d.low, m) ? 3 : 0);
          break;
        case 'food':
          v = base + (has(d.peak, m) ? 1 : 0) - (d.shopClosures && has(d.low, m) ? 3 : 0);
          break;
        case 'shopping':
          v = base + (has(d.peak, m) ? 1 : 0) - (d.shopClosures && has(d.low, m) ? 4 : 0);
          break;
        case 'deals':
        case 'crowds':
          // Same peakIntensity tier that drives the badge/blurb text now
          // also drives the actual "Avoiding Crowds"/"Low-Season Deals"
          // slider score, so the number and the words agree — a mild
          // peak (e.g. Peru in June) scores close to a normal month, not
          // as badly as an extreme one (Amalfi in August).
          if (has(d.peak, m)) {
            const intensity = d.peakIntensity || 'moderate';
            v = intensity === 'extreme' ? 1 : intensity === 'mild' ? 5 : 3;
          } else {
            v = has(d.low, m) ? 9 : 6;
          }
          break;
        case 'birding':
          // Bonus is wide (not +3) so narrow-window destinations can carry a
          // low, honest off-season base (see churchill/alaska) and still
          // reach a true 9-10 during their real peak weeks. For destinations
          // whose base is already high year-round, the extra bonus is
          // absorbed by clamp10 below and changes nothing.
          v = base + (has(d.birdingPeak, m) ? 7 : 0) - (has(d.wet, m) && !has(d.birdingPeak, m) ? 1 : 0);
          break;
        case 'wildlife':
          v = base + (has(d.wildlifePeak, m) ? 7 : 0) - (has(d.wet, m) && !has(d.wildlifePeak, m) ? 1 : 0);
          if (has(d.wildlifeClosed, m)) v = Math.min(v, 1);
          break;
        default:
          v = base;
      }
      monthly[s.key][idx] = clamp10(v);
    });

    if (has(d.wildlifeClosed, m)) {
      monthly.birding[idx] = Math.min(monthly.birding[idx], 3);
    }

    badges[idx] = computeBadges(d, m);
  }

  return { monthly, badges, weatherBand };
}

const RAW_DESTINATIONS = [
  { id: 'bali', name: 'Bali', region: 'Indonesia', emoji: '🌴', climate: 'tropical',
    about: 'Rice terraces, surf, temples. Dry season is firmly Apr–Oct; Nov–Mar is the wet, humid monsoon.',
    base: { sunbathing:8, swimming:7, diving:8, surfing:8, sailing:5, hiking:6, scenic:7, fishing:3, roadtrip:5, adventure:5, golf:3, stargazing:4, museums:5, architecture:6, festivals:4, finedining:6, streetfood:9, nightlife:7, winetasting:1, spa:9, snowsports:0, cycling:4, shopping:7, birding:5, wildlife:3 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'casual', mountainBiking: 'none' }, scenic: { mountains: 'strong', coastlines: 'strong', forests: 'casual', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [4,5,6,7,8,9,10], wet: [11,12,1,2,3], peak: [6,7,8,12], low: [1,2,3,11],
    birdingPeak: [4,5,6,7,8,9,10], wildlifePeak: [4,5,6,7,8,9,10], sliderCaps: { wildlife: 4, birding: 6 }, sliderEvents: { festivals: [
      { label: 'Nyepi season (Balinese New Year)', weight: 3, months: { 3: 1 } },
    ] }, naSliders: ['snowsports', 'winetasting'],
    monthlyWeather: [
      "the wettest month, with humid air and short, heavy afternoon downpours",
      "still deep in the wet season, humid with frequent rain",
      "rain starts tapering off, though afternoon showers are still common",
      "transitioning to dry, warm and increasingly sunny",
      "warm, dry, and one of the most pleasant months of the year",
      "dry and breezy, with comfortable warmth and little rain",
      "dry season in full swing, sunny and warm",
      "the driest month, hot and reliably sunny",
      "still dry and warm, with rain yet to return",
      "transitioning back to wet, though still mostly dry and warm",
      "rain returns and humidity climbs as the wet season begins",
      "humid and increasingly wet, with rain building toward its January peak"
    ], searchAliases: ['Ubud', 'Seminyak', 'Canggu', 'Uluwatu'] },
  { id: 'thailand', name: 'Thailand — Phuket & Islands', region: 'Thailand', emoji: '🏝️', climate: 'tropical',
    about: 'Cool-dry season Nov–Feb is the sweet spot; monsoon Jun–Oct brings rough seas and closed island services.',
    base: { sunbathing:9, swimming:8, diving:9, surfing:3, sailing:6, hiking:4, scenic:6, fishing:3, roadtrip:3, adventure:4, golf:5, stargazing:3, museums:3, architecture:4, festivals:5, finedining:6, streetfood:10, nightlife:8, winetasting:1, spa:8, snowsports:0, cycling:3, shopping:8, birding:5, wildlife:4 },
    activityStyleTiers: { scenic: { coastlines: 'strong', mountains: 'none', forests: 'none', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively','highenergy'], physicalBands: ['easy','moderate'],
    dry: [11,12,1,2], wet: [6,7,8,9,10], hot: [3,4,5], peak: [11,12,1], low: [6,7,8,9], shopClosures: true, swimHazard: [6,7,8,9,10],
    birdingPeak: [11,12,1,2], wildlifePeak: [11,12,1,2], sliderCaps: { wildlife: 4, birding: 5 }, naSliders: ['snowsports', 'winetasting'],
    monthlyWeather: [
      "dry, sunny, and one of the most pleasant months of the year",
      "dry and hot, with the year's least rainfall",
      "hot and mostly dry, with humidity starting to build",
      "hot and increasingly humid, just before the monsoon arrives",
      "the monsoon begins, hot and humid with building afternoon rain",
      "hot and rainy, with regular but often brief downpours",
      "hot and humid, with rain most days",
      "hot and humid, still deep in the rainy season",
      "the wettest month, hot with frequent heavy rain",
      "rainy and humid, though showers start easing toward month's end",
      "drying out, warm with rain becoming less frequent",
      "dry, sunny, and cooling into the most comfortable stretch of the year"
    ], searchAliases: ['Phuket', 'Krabi', 'Phi Phi'] },
  { id: 'costa-rica', name: 'Costa Rica', region: 'Central America', emoji: '🐸', climate: 'tropical',
    about: 'Dry season (Pacific side) Dec–Apr is prime for wildlife and trails; green season is lush, quieter and cheaper.',
    base: { sunbathing:7, swimming:7, diving:6, surfing:7, sailing:4, hiking:6, scenic:7, fishing:7, roadtrip:6, adventure:8, golf:3, stargazing:5, museums:2, architecture:2, festivals:3, finedining:4, streetfood:6, nightlife:3, winetasting:1, spa:5, snowsports:0, cycling:4, shopping:4, birding:6, wildlife:7 },
    activityStyleTiers: { cycling: { mountainBiking: 'casual', scenicRoadCycling: 'casual', gravelRiding: 'casual' }, scenic: { forests: 'signature', coastlines: 'strong', mountains: 'casual', deserts: 'none', astrophotography: 'casual' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate','active'],
    dry: [12,1,2,3,4], wet: [9,10], peak: [12,1,2,3,4], low: [9,10],
    sliderEvents: { wildlife: [
      { label: 'Dry-season trail access & visibility', weight: 2.5, months: { 12: 0.7, 1: 1, 2: 1, 3: 1, 4: 0.6 } },
    ], birding: [
      { label: 'Dry-season trail access & birding activity', weight: 3.5, months: { 1: 1, 2: 1, 3: 1, 4: 0.5, 12: 0.6 } },
    ], hiking: [
      { label: 'Dry-season trail access', weight: 3, months: { 1: 1, 2: 1, 3: 1, 4: 0.5, 12: 0.6 } },
    ], scenic: [
      { label: 'Dry-season clarity', weight: 2, months: { 1: 0.85, 2: 0.85, 3: 0.85, 4: 0.4, 12: 0.5 } },
    ] }, naSliders: ['snowsports', 'winetasting'],
    monthlyWeather: [
      "dry and sunny, with cooling trade winds especially noticeable",
      "dry and warm, one of the sunniest stretches of the year",
      "hot and dry, with barely any rain",
      "hot and dry, though the first rains are approaching by month's end",
      "transitioning to wet, warm with afternoon showers becoming regular",
      "warm and rainy, with the first peak of the wet season",
      "a brief dry spell within the rains, warm with breezier trade winds",
      "still in that drier lull, warm with lighter afternoon showers",
      "the rainiest stretch of the year, warm with frequent downpours",
      "warm and very wet, with rain most afternoons",
      "still rainy, though showers begin tapering off",
      "drying out fast, warm and increasingly sunny"
    ], searchAliases: ['Manuel Antonio', 'Arenal', 'Monteverde', 'Tamarindo'] },
  { id: 'kenya', name: 'Maasai Mara & Coast', region: 'Kenya', emoji: '🦁', climate: 'tropical',
    about: 'Long dry season Jun–Oct brings the migration river crossings; Palearctic migrant birds arrive Nov–Mar.',
    base: { sunbathing:8, swimming:8, diving:5, surfing:2, sailing:3, hiking:5, scenic:8, fishing:4, roadtrip:5, adventure:4, golf:2, stargazing:7, museums:4, architecture:3, festivals:5, finedining:4, streetfood:4, nightlife:3, winetasting:1, spa:4, snowsports:0, cycling:2, shopping:5, birding:5, wildlife:8 },
    activityStyleTiers: { scenic: { coastlines: 'strong', mountains: 'none', forests: 'none', deserts: 'none', astrophotography: 'casual' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate'],
    dry: [1,2,6,7,8,9,10], wet: [3,4,5], peak: [7,8,9,10,12,1], peakIntensity: 'extreme', low: [4,5],
    sliderEvents: { wildlife: [
      { label: 'Great Migration river crossings', weight: 2, months: { 6: 0.5, 7: 1, 8: 1, 9: 1, 10: 0.7 } },
    ], birding: [
      { label: 'Palearctic migrant arrivals', weight: 4, months: { 1: 1, 2: 1, 3: 0.6, 11: 0.4, 12: 0.85 } },
    ] }, specialSeasons: [{ months: [7,8,9,10], text: "This is peak Great Migration season, with wildebeest herds making dramatic Mara River crossings." }], naSliders: ['snowsports', 'winetasting'],
    monthlyWeather: [
      "warm and mostly dry, with the coast at its hottest",
      "warm and dry, one of the best stretches before the long rains",
      "warm with the long rains building, increasingly wet",
      "the wettest month, warm with frequent, heavy downpours",
      "still rainy, though showers begin easing as the month goes on",
      "cooler and dry, with rain now rare",
      "the coolest month, dry with crisp mornings on the savanna",
      "dry and mild, with clear skies across the Mara",
      "dry and warming again, still very little rain",
      "dry and warm, with the short rains still weeks away",
      "the short rains arrive, warm with brief afternoon showers",
      "warm with light, intermittent rain from the short rains tailing off"
    ], searchAliases: ['Maasai Mara', 'Masai Mara', 'Mombasa', 'Diani Beach'] },
  { id: 'tanzania', name: 'Serengeti & Zanzibar', region: 'Tanzania', emoji: '🐘', climate: 'tropical',
    about: 'Two wildlife peaks: the Jan–Mar Ndutu calving season and the Jun–Oct dry-season migration. Long rains hit Mar–May.',
    base: { sunbathing:9, swimming:8, diving:6, surfing:2, sailing:5, hiking:4, scenic:6, fishing:4, roadtrip:5, adventure:4, golf:1, stargazing:7, museums:5, architecture:4, festivals:5, finedining:5, streetfood:5, nightlife:4, winetasting:1, spa:5, snowsports:0, cycling:2, shopping:6, birding:5, wildlife:7 },
    activityStyleTiers: { scenic: { coastlines: 'strong', astrophotography: 'casual', mountains: 'none', forests: 'none', deserts: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate'],
    dry: [6,7,8,9,10], wet: [3,4,5], peak: [7,8,9,1,2], peakIntensity: 'extreme', low: [4,5],
    sliderEvents: { wildlife: [
      { label: 'Ndutu calving season', weight: 2.5, months: { 1: 1, 2: 1, 3: 0.7 } },
      { label: 'Great Migration river crossings', weight: 2.5, months: { 6: 0.5, 7: 1, 8: 1, 9: 1, 10: 0.7 } },
    ], birding: [
      { label: 'Palearctic migrant arrivals', weight: 4, months: { 1: 1, 2: 1, 3: 0.7, 4: 0.4, 11: 0.4, 12: 0.7 } },
    ], scenic: [
      { label: 'Dry-season clarity', weight: 3, months: { 6: 0.6, 7: 0.85, 8: 1, 9: 1, 10: 0.7 } },
    ] }, specialSeasons: [{ months: [1,2,3], text: "Huge herds gather on the Ndutu plains for calving season, drawing large numbers of predators." }, { months: [6,7,8,9,10], text: "The Great Migration herds move north through the Serengeti now, including dramatic river crossings." }], naSliders: ['snowsports', 'winetasting'],
    monthlyWeather: [
      "warm and mostly dry, calving season on the southern plains",
      "warm and dry, among the best months before the rains build",
      "warm with the long rains setting in, increasingly wet",
      "the wettest month, warm with heavy, sustained downpours",
      "still wet early on, drying out steadily as the month progresses",
      "cooler and dry, with rain now rare",
      "the coolest, driest month, clear skies and crisp mornings",
      "dry and mild, ideal for long days outdoors",
      "dry and warming, still very little rain",
      "dry and warm, the last stretch before the short rains",
      "the short rains arrive, warm with brief, scattered showers",
      "hot and humid on the coast, with light rain tapering off inland"
    ], searchAliases: ['Serengeti', 'Zanzibar', 'Ngorongoro', 'Kilimanjaro'] },
  { id: 'cape-town', name: 'Cape Town', region: 'South Africa', emoji: '🍷', climate: 'mediterranean',
    about: 'Mediterranean climate flipped south: warm dry summer Nov–Mar for beaches/hiking, wet winter Jun–Aug (good whale season).',
    base: { sunbathing:8, swimming:6, diving:5, surfing:6, sailing:6, hiking:8, scenic:9, fishing:4, roadtrip:7, adventure:6, golf:6, stargazing:5, museums:8, architecture:8, festivals:6, finedining:9, streetfood:7, nightlife:7, winetasting:8, spa:6, snowsports:0, cycling:6, shopping:8, birding:6, wildlife:6 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'strong', mountainBiking: 'casual', gravelRiding: 'casual' }, scenic: { mountains: 'signature', coastlines: 'signature', forests: 'casual', deserts: 'casual', astrophotography: 'casual' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate','active'],
    dry: [11,12,1,2,3], wet: [6,7,8], peak: [12,1,2], low: [6,7],
    hikingBest: [10,11,12,1,2,3,4], hikingWorst: [6,7], wildlifePeak: [7,8,9,10], birdingPeak: [9,10,11], sliderCaps: { wildlife: 6, birding: 8 }, sliderEvents: { winetasting: [
      { label: 'Stellenbosch harvest season', weight: 1, months: { 2: 0.5, 3: 0.7 } },
    ] }, specialSeasons: [{ months: [7,8,9,10], text: "Southern right whales come close to shore this time of year, often visible from land around Hermanus." }], naSliders: ['snowsports'],
    monthlyWeather: [
      "warm and dry, with the summer's strong \"Cape Doctor\" wind a regular feature",
      "the hottest month, dry with occasional wind and days that can push past 35°C",
      "still warm and mostly dry, as the wind starts to ease",
      "mild and increasingly wet, with the first real rain returning",
      "cooling down, with rain becoming more regular",
      "the wettest month, cool with frequent rain and cold fronts",
      "cold and wet, the heart of the rainy season",
      "still cool and rainy, though the worst of winter is passing",
      "mild and drying out, with spring flowers starting to bloom",
      "warming nicely, mostly dry with pleasant days",
      "warm and dry, with the summer wind starting to build",
      "warm and dry, sliding into the windy heart of summer"
    ], searchAliases: ['Table Mountain', 'Cape Peninsula', 'Stellenbosch'] },
  { id: 'kruger', name: 'Kruger National Park', region: 'South Africa', emoji: '🐆', climate: 'tropical',
    about: 'Dry winter (May–Sep) concentrates animals at waterholes — prime game viewing. Wet summer is lush but green and dispersed.',
    base: { sunbathing:1, swimming:1, diving:1, surfing:1, sailing:1, hiking:6, scenic:7, fishing:3, roadtrip:4, adventure:3, golf:1, stargazing:6, museums:1, architecture:1, festivals:1, finedining:2, streetfood:2, nightlife:1, winetasting:1, spa:2, snowsports:0, cycling:1, shopping:3, birding:5, wildlife:7 },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded'], physicalBands: ['easy','moderate'],
    dry: [5,6,7,8,9], wet: [11,12,1,2,3], peak: [6,7,8,9], low: [1,2,11],
    hikingBest: [5,6,7,8,9], hikingWorst: [12,1,2], sliderEvents: { wildlife: [
      { label: 'Dry-season waterhole concentration', weight: 3, months: { 5: 0.5, 6: 0.85, 7: 1, 8: 1, 9: 0.7 } },
    ], birding: [
      { label: 'Palearctic migrant arrivals', weight: 4, months: { 1: 1, 2: 1, 3: 0.6, 11: 0.4, 12: 0.85 } },
    ] }, naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'sailing', 'museums', 'architecture', 'festivals', 'nightlife', 'winetasting'],
    monthlyWeather: [
      "hot and humid, with frequent afternoon thunderstorms",
      "hot and humid, still deep in the rainy season",
      "warm and humid, with rain beginning to ease",
      "warm and drying out, with rain now infrequent",
      "mild and dry, with the bush thinning out fast",
      "cool and dry, with crisp mornings and almost no rain",
      "the coolest month, dry with chilly early mornings",
      "dry and warming, still very little rain",
      "warm and dry, with the bush at its most bare",
      "hot and dry, building toward the first summer storms",
      "hot, with the rains returning and afternoon storms building",
      "hot and humid, with regular thunderstorms"
    ], searchAliases: ['Sabi Sands'] },
  { id: 'botswana', name: 'Okavango Delta', region: 'Botswana', emoji: '🛶', climate: 'tropical',
    about: 'Flood waters peak Jun–Aug and animals concentrate through Oct — the classic dry-season game-viewing window.',
    base: { sunbathing:1, swimming:2, diving:1, surfing:1, sailing:3, hiking:4, scenic:7, fishing:4, roadtrip:3, adventure:3, golf:1, stargazing:6, museums:1, architecture:1, festivals:1, finedining:2, streetfood:2, nightlife:1, winetasting:1, spa:3, snowsports:0, cycling:1, shopping:2, birding:5, wildlife:7 },
    budgetBands: ['highend','luxury'], vibeBands: ['secluded'], physicalBands: ['easy','moderate'],
    dry: [5,6,7,8,9,10], wet: [11,12,1,2,3,4], peak: [6,7,8,9], peakIntensity: 'mild', low: [1,2,11],
    sliderEvents: { wildlife: [
      { label: 'Dry-season concentration', weight: 3, months: { 5: 0.4, 6: 0.7, 7: 1, 8: 1, 9: 0.85, 10: 0.5 } },
    ], birding: [
      { label: 'Wet-season migratory bird arrivals', weight: 4, months: { 1: 1, 2: 1, 3: 0.6, 11: 0.4, 12: 0.85 } },
    ] }, specialSeasons: [{ months: [5,6,7,8,9,10], text: "Floodwaters arriving from Angola concentrate wildlife along the Delta's remaining channels." }], naSliders: ['snowsports', 'surfing', 'diving', 'museums', 'architecture', 'festivals', 'nightlife', 'winetasting'],
    monthlyWeather: [
      "hot and wet, with regular afternoon thunderstorms",
      "hot and humid, still in the heart of the rains",
      "hot with rain easing, as floodwater from Angola begins arriving",
      "warm and drying out, with the delta's floodwaters still rising",
      "mild and dry, mornings turning noticeably cool",
      "cold mornings and mild dry days, with the flood nearing its peak",
      "the coldest month, chilly mornings but the delta at its fullest",
      "cool mornings, mild days, and the floodwaters still spread wide",
      "warming up fast, dry with the delta beginning to recede",
      "hot and dry, the last stretch before the rains return",
      "hot, with the first storms of the wet season building",
      "hot and increasingly wet, with regular afternoon rain"
    ], searchAliases: ['Okavango', 'Chobe', 'Moremi'] },
  { id: 'iceland', name: 'Iceland', region: 'Nordic', emoji: '❄️', climate: 'polar',
    about: 'Midnight sun and full road access Jun–Aug; Nov–Feb trades daylight for aurora chances and dramatically lower prices.',
    base: { sunbathing:1, swimming:1, diving:4, surfing:2, sailing:3, hiking:5, scenic:7, fishing:6, roadtrip:9, adventure:7, golf:1, stargazing:2, museums:4, architecture:4, festivals:4, finedining:5, streetfood:3, nightlife:4, winetasting:1, spa:7, snowsports:6, cycling:3, shopping:5, birding:6, wildlife:6 },
    activityStyleTiers: { scenic: { coastlines: 'signature', astrophotography: 'signature', mountains: 'casual', deserts: 'casual', forests: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded','easygoing'], physicalBands: ['moderate','active','challenging'],
    dry: [6,7,8], wet: [], cold: [11,12,1,2,3], peak: [6,7,8], peakIntensity: 'extreme', low: [11,1,2],
    hikingBest: [6,7,8], hikingWorst: [11,12,1,2], birdingPeak: [5,6,7], wildlifePeak: [6,7,8], sliderCaps: { wildlife: 6, birding: 7 }, sliderEvents: { hiking: [
      { label: 'Full road access & long daylight', weight: 3, months: { 6: 1, 7: 1, 8: 1 } },
    ], scenic: [
      { label: 'Peak waterfall/greenery season', weight: 2, months: { 6: 0.7, 7: 1, 8: 0.7 } },
    ], stargazing: [
      { label: 'Long winter darkness', weight: 7, months: { 1: 1, 2: 0.85, 3: 0.6, 4: 0.3, 5: 0.15, 9: 0.3, 10: 0.6, 11: 0.85, 12: 1 } },
    ] }, specialSeasons: [{ months: [6,7,8], text: "The midnight sun keeps the sky bright nearly around the clock." }, { months: [11,12,1,2,3], text: "Long, dark nights make this prime aurora-hunting season, weather permitting." }], naSliders: ['swimming', 'winetasting'],
    monthlyWeather: [
      "cold, dark, and the year's windiest month, with only a few hours of daylight",
      "still cold and blustery, with heavy snow and short days",
      "cold with the year's other rain peak, though daylight is lengthening fast",
      "cool and brightening quickly, with real daylight returning",
      "mild and increasingly bright, with nearly endless evening light",
      "cool but genuinely light around the clock under the midnight sun",
      "the mildest month, still cool by most standards but the best chance of calm, clear days",
      "still mild, with darkness slowly creeping back into the evenings",
      "cooling fast, with the first serious storms of the season rolling through",
      "cold and increasingly stormy, with rain and wind picking up",
      "cold, dark, and unsettled, with daylight shrinking toward its winter low",
      "the darkest month, cold with only a handful of daylight hours"
    ], searchAliases: ['Reykjavik', 'Blue Lagoon', 'Golden Circle'] },
  { id: 'lofoten', name: 'Lofoten Islands', region: 'Norway', emoji: '🏔️', climate: 'polar',
    about: 'Summer midnight sun is best for hiking; deep winter brings northern lights and orca season nearby.',
    base: { sunbathing:1, swimming:1, diving:2, surfing:2, sailing:4, hiking:4, scenic:7, fishing:6, roadtrip:8, adventure:6, golf:1, stargazing:2, museums:2, architecture:3, festivals:2, finedining:4, streetfood:2, nightlife:2, winetasting:1, spa:4, snowsports:5, cycling:3, shopping:3, birding:5, wildlife:7 },
    activityStyleTiers: { scenic: { coastlines: 'signature', mountains: 'strong', astrophotography: 'signature', deserts: 'none', forests: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded'], physicalBands: ['moderate','active','challenging'],
    dry: [6,7,8], wet: [], cold: [11,12,1,2,3], peak: [6,7], low: [11,2],
    hikingBest: [6,7,8], hikingWorst: [11,12,1,2], birdingPeak: [5,6,7,8], wildlifePeak: [5,6,7,8,11,12,1], sliderCaps: { wildlife: 8, birding: 7 }, sliderEvents: { hiking: [
      { label: 'Midnight sun trail access', weight: 4, months: { 6: 0.8, 7: 1, 8: 0.8 } },
    ], scenic: [
      { label: 'Midnight sun peak season', weight: 2, months: { 6: 0.7, 7: 1, 8: 0.7 } },
    ], stargazing: [
      { label: 'Long winter darkness', weight: 7, months: { 1: 1, 2: 0.85, 3: 0.6, 4: 0.3, 5: 0.15, 9: 0.3, 10: 0.6, 11: 0.85, 12: 1 } },
    ] }, specialSeasons: [{ months: [6,7,8], text: "The midnight sun keeps it light around the clock, good for late-night hiking." }, { months: [11,12,1], text: "Orcas hunting herring move into nearby fjords, and dark skies bring strong aurora chances." }], naSliders: ['swimming', 'winetasting'],
    monthlyWeather: [
      "cold and often windy, with only a few hours of weak daylight",
      "the coldest month, still dark with brief daylight slowly returning",
      "cold but brightening fast, with daylight lengthening quickly",
      "cool, with real daylight back and the wind starting to ease",
      "mild and increasingly bright, with the midnight sun beginning late in the month",
      "cool but genuinely light around the clock under the midnight sun",
      "the mildest month, calm and the best chance of clear, settled days",
      "still mild and the calmest month for wind, with darkness slowly returning",
      "cooling down, with rain becoming more frequent",
      "cool and wet, the rainiest month of the year",
      "cold and increasingly dark, with aurora chances building",
      "cold, dark, and the windiest month, with only a few hours of daylight"
    ], searchAliases: ['Norway', 'Reine', 'Arctic Circle'] },
  { id: 'algarve', name: 'Algarve', region: 'Portugal', emoji: '🏖️', climate: 'mediterranean',
    about: 'Hot dry summer (Jun–Sep) is peak beach season; spring/fall shoulder months offer great weather with far fewer crowds.',
    base: { sunbathing:9, swimming:7, diving:4, surfing:7, sailing:6, hiking:6, scenic:6, fishing:5, roadtrip:5, adventure:4, golf:9, stargazing:3, museums:4, architecture:5, festivals:5, finedining:7, streetfood:5, nightlife:6, winetasting:5, spa:6, snowsports:0, cycling:5, shopping:6, birding:4, wildlife:3 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'casual', mountainBiking: 'none' }, scenic: { coastlines: 'strong', mountains: 'none', forests: 'none', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [6,7,8,9], wet: [11,12,1,2], peak: [7,8], low: [12,1,2],
    hikingBest: [4,5,9,10], hikingWorst: [7,8], birdingPeak: [3,4,9,10,11], sliderCaps: { birding: 7 }, naSliders: ['snowsports'],
    monthlyWeather: [
      "mild, with the year's wettest weather from Atlantic storms",
      "mild and still fairly wet, though rain starts easing",
      "mild and drying out, with sunnier stretches returning",
      "warm and increasingly dry, one of the more pleasant months",
      "warm, sunny, and mostly dry — a favorite shoulder month",
      "hot and dry, with rain now rare",
      "hot and dry, calm and clear through most days",
      "the hottest month, dry with reliable sunshine",
      "still hot and dry, another favorite shoulder month",
      "warm and drying, with the first Atlantic rain returning late in the month",
      "mild and wet, as rainy weather sets back in",
      "mild, with the year's heaviest rain from Atlantic storms"
    ], searchAliases: ['Lagos', 'Faro', 'Portugal'] },
  { id: 'canaries', name: 'Canary Islands', region: 'Spain', emoji: '🌋', climate: 'mediterranean',
    about: 'Subtropical "eternal spring" climate — one of the few places that stays genuinely warm and sunny even in January.',
    base: { sunbathing:8, swimming:7, diving:6, surfing:7, sailing:6, hiking:7, scenic:8, fishing:5, roadtrip:6, adventure:5, golf:6, stargazing:6, museums:3, architecture:4, festivals:4, finedining:5, streetfood:5, nightlife:6, winetasting:5, spa:6, snowsports:2, cycling:6, shopping:6, birding:5, wildlife:4 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'signature', gravelRiding: 'casual', mountainBiking: 'none' }, scenic: { coastlines: 'signature', mountains: 'strong', deserts: 'casual', forests: 'casual', astrophotography: 'strong' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate','active'],
    dry: [1,2,3,4,5,6,7,8,9,10,11,12], wet: [], peak: [12,1,2,7,8], low: [5,6,10,11],
    birdingPeak: [10,11,12,1,2,3], wildlifePeak: [3,4,5], sliderCaps: { wildlife: 4, birding: 6 }, naSliders: ['snowsports'],
    monthlyWeather: [
      "mild, the coolest month but still comfortably warm by day",
      "mild and dry on the south coast, with trade-wind cloud drifting over the north",
      "mild and sunny, warming gradually",
      "warm and dry, one of the most pleasant months of the year",
      "warm and dry, with the trade winds keeping things comfortable",
      "warm, with steady trade winds and little rain",
      "warm and dry, calm and sunny across the south",
      "the warmest month, dry with reliable sunshine",
      "still warm, with the trade winds beginning to ease",
      "warm and mild, one of the more comfortable months",
      "mild, with the first real rain of the season returning",
      "mild, the wettest month though still far drier than most of Europe"
    ], searchAliases: ['Tenerife', 'Gran Canaria', 'Lanzarote', 'Fuerteventura', 'Spain'] },
  { id: 'santorini', name: 'Santorini & Cyclades', region: 'Greece', emoji: '🇬🇷', climate: 'mediterranean',
    about: 'Peak Jul–Aug is hot, crowded and pricey. Many hotels/restaurants close entirely Nov–Mar — check availability, not just weather.',
    base: { sunbathing:9, swimming:8, diving:4, surfing:2, sailing:8, hiking:5, scenic:7, fishing:2, roadtrip:4, adventure:2, golf:1, stargazing:5, museums:6, architecture:9, festivals:5, finedining:8, streetfood:5, nightlife:7, winetasting:7, spa:6, snowsports:0, cycling:3, shopping:7, birding:3, wildlife:2 },
    activityStyleTiers: { scenic: { coastlines: 'signature', deserts: 'casual', mountains: 'none', forests: 'none', astrophotography: 'casual' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [6,7,8,9], wet: [11,12,1,2], peak: [7,8], peakIntensity: 'extreme', low: [11,12,1,2], shopClosures: true,
    hikingBest: [5,6,9,10], hikingWorst: [7,8], sliderEvents: { scenic: [
      { label: 'Shoulder-season light', weight: 2, months: { 5: 0.7, 6: 0.85, 9: 0.85, 10: 0.7 } },
    ] }, naSliders: ['snowsports'],
    monthlyWeather: [
      "cool and rainy, the wettest and coldest month of the year",
      "cool and still fairly wet, with rain easing gradually",
      "mild and drying out, with sunnier days returning",
      "mild and mostly dry, a quiet and pleasant month",
      "warm and dry, before the wind and crowds arrive",
      "warm and dry, with the meltemi wind beginning to pick up",
      "hot, dry, and often windy, as the meltemi blows steadily across the caldera",
      "the hottest month, dry with the meltemi at its strongest",
      "warm and dry, with the meltemi easing as the month goes on",
      "mild and drier than most of the Aegean, with rain returning late",
      "cool and increasingly wet, as the rainy season sets in",
      "cool and rainy, mild by day but often overcast"
    ], searchAliases: ['Oia', 'Fira', 'Greece', 'Mykonos'] },
  { id: 'amalfi', name: 'Amalfi Coast', region: 'Italy', emoji: '🍋', climate: 'mediterranean',
    about: 'Jun–Aug is beautiful but packed and expensive on narrow coastal roads. Apr–May and Sep–Oct are the local favorite.',
    base: { sunbathing:8, swimming:7, diving:4, surfing:1, sailing:8, hiking:7, scenic:8, fishing:2, roadtrip:8, adventure:3, golf:1, stargazing:3, museums:7, architecture:9, festivals:5, finedining:9, streetfood:6, nightlife:6, winetasting:6, spa:5, snowsports:0, cycling:3, shopping:7, birding:3, wildlife:2 },
    activityStyleTiers: { scenic: { coastlines: 'signature', mountains: 'casual', forests: 'none', deserts: 'none', astrophotography: 'casual' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [6,7,8], wet: [12,1,2], peak: [6,7,8], peakIntensity: 'extreme', low: [12,1,2], shopClosures: true,
    hikingBest: [4,5,9,10], hikingWorst: [7,8], sliderEvents: { scenic: [
      { label: 'Shoulder-season clarity', weight: 1.5, months: { 4: 0.6, 5: 0.85, 9: 0.85, 10: 0.6 } },
    ] }, naSliders: ['snowsports', 'surfing'],
    monthlyWeather: [
      "cold and quiet, with many hotels and restaurants closed for the season",
      "the coldest month, still quiet with limited services along the coast",
      "mild and brightening, though still too cool to swim",
      "mild and increasingly sunny, with the coast waking back up",
      "warm and mostly dry, one of the best months before the summer crowds",
      "warm, sunny, and increasingly busy as the season ramps up",
      "hot and crowded, with narrow coastal roads jammed at peak season",
      "the hottest month, packed with Italian holidaymakers and premium prices",
      "warm and sunny, with crowds thinning noticeably after mid-month",
      "mild and pleasant, one of the best shoulder months for fewer crowds",
      "cool and the wettest month, with many businesses starting to close",
      "cool and quiet, with most coastal towns settling into their off-season lull"
    ], searchAliases: ['Positano', 'Sorrento', 'Capri', 'Ravello'] },
  { id: 'croatia', name: 'Dalmatian Coast', region: 'Croatia', emoji: '⛵', climate: 'mediterranean',
    about: 'Peak Jul–Aug for island-hopping and sailing; May–Jun and Sep offer warm water with a fraction of the crowds.',
    base: { sunbathing:8, swimming:8, diving:5, surfing:2, sailing:9, hiking:6, scenic:7, fishing:3, roadtrip:6, adventure:4, golf:2, stargazing:4, museums:6, architecture:8, festivals:5, finedining:7, streetfood:5, nightlife:7, winetasting:6, spa:5, snowsports:0, cycling:4, shopping:6, birding:4, wildlife:3 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'strong', gravelRiding: 'casual', mountainBiking: 'none' }, scenic: { coastlines: 'signature', mountains: 'casual', forests: 'casual', deserts: 'none', astrophotography: 'casual' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [6,7,8,9], wet: [12,1,2], peak: [7,8], low: [12,1,2], shopClosures: true,
    hikingBest: [5,6,9], hikingWorst: [1,2], sliderEvents: { scenic: [
      { label: 'Shoulder-season clarity', weight: 2, months: { 5: 0.7, 6: 0.85, 9: 0.85 } },
    ] }, naSliders: ['snowsports'],
    monthlyWeather: [
      "cold and quiet, the coldest month with limited services on the islands",
      "cold and still quiet, with rain the norm along the coast",
      "mild and brightening, though the sea's still too cool for swimming",
      "mild and increasingly sunny, with the coast waking up",
      "warm and sunny, one of the best months before peak crowds",
      "warm, sunny, and increasingly busy as the sailing season kicks in",
      "hot, dry, and the peak of the island-hopping season",
      "the hottest month, packed with crowds and the busiest sailing traffic",
      "warm and sunny still, with crowds and prices easing",
      "mild and pleasant, a favorite shoulder month with warm sea",
      "cool and rainy, the wettest month of the year",
      "cool and quiet, with most islands settling into their off-season"
    ], searchAliases: ['Dubrovnik', 'Split', 'Hvar', 'Korcula'] },
];
RAW_DESTINATIONS.push(
  { id: 'morocco', name: 'Marrakech & Atlas', region: 'Morocco', emoji: '🕌', climate: 'desert',
    about: 'Spring (Mar–May) and fall (Sep–Nov) are ideal for souks and mountain trekking; summer inland heat is brutal for hiking.',
    base: { sunbathing:5, swimming:5, diving:2, surfing:4, sailing:2, hiking:7, scenic:7, fishing:2, roadtrip:7, adventure:5, golf:6, stargazing:6, museums:7, architecture:10, festivals:6, finedining:7, streetfood:9, nightlife:5, winetasting:2, spa:8, snowsports:2, cycling:3, shopping:10, birding:6, wildlife:3 },
    activityStyleTiers: { scenic: { deserts: 'signature', mountains: 'strong', coastlines: 'casual', forests: 'none', astrophotography: 'strong' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate','active'],
    dry: [3,4,5,9,10,11], wet: [], hot: [6,7,8], peak: [3,4,10,11], low: [7,8],
    hikingBest: [3,4,5,9,10,11], hikingWorst: [7,8], birdingPeak: [3,4,10,11], sliderCaps: { birding: 6 }, naSliders: ['snowsports'],
    monthlyWeather: [
      "mild by day but cold at night, with the Atlas peaks capped in snow",
      "mild and dry, warming gradually with cool evenings",
      "warming up fast, dry with comfortable days and cool nights",
      "warm and dry, one of the best months for trekking and the souks",
      "warm and dry, still comfortable before the summer heat sets in",
      "hot and dry, with desert camps starting to feel the heat",
      "scorching and dry, with Sahara daytime highs regularly above 40°C",
      "the hottest month, brutally dry heat especially in the desert and inland valleys",
      "still hot but easing, dry with comfortable evenings returning",
      "warm and dry, one of the best months for the whole country",
      "mild and dry, cooling fast with pleasant days",
      "mild by day but cold at night, with snow dusting the High Atlas"
    ], searchAliases: ['Fes', 'Fez', 'Sahara', 'Chefchaouen'] },
  { id: 'egypt', name: 'Red Sea & Nile', region: 'Egypt', emoji: '🐪', climate: 'desert',
    about: 'Oct–Apr is warm, dry and comfortable for sightseeing and diving; Jun–Aug is punishingly hot, especially inland.',
    base: { sunbathing:8, swimming:8, diving:10, surfing:2, sailing:6, hiking:3, scenic:6, fishing:3, roadtrip:4, adventure:3, golf:3, stargazing:6, museums:10, architecture:10, festivals:4, finedining:5, streetfood:7, nightlife:4, winetasting:1, spa:5, snowsports:0, cycling:2, shopping:7, birding:5, wildlife:3 },
    activityStyleTiers: { scenic: { deserts: 'strong', coastlines: 'casual', mountains: 'none', forests: 'none', astrophotography: 'casual' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing'], physicalBands: ['easy','moderate'],
    dry: [10,11,12,1,2,3,4], wet: [], hot: [6,7,8], peak: [12,1,2,3], low: [7,8],
    hikingBest: [10,11,12,1,2,3], hikingWorst: [6,7,8], birdingPeak: [11,12,1,2,3], sliderCaps: { birding: 5 }, naSliders: ['snowsports', 'winetasting'],
    monthlyWeather: [
      "mild and dry, the coolest month with comfortable sightseeing weather",
      "mild and dry, still comfortably cool for Nile touring",
      "warming up, dry with pleasant days and cool evenings",
      "warm and dry, with heat building steadily inland",
      "hot and dry, especially in Luxor and Aswan",
      "very hot and dry, with the Nile Valley regularly above 40°C",
      "scorching and dry, among the hottest months in Luxor and Aswan",
      "the hottest month, punishingly dry heat away from the Red Sea coast",
      "still hot, dry with heat beginning to ease by month's end",
      "warm and dry, one of the best months for sightseeing",
      "mild and dry, with comfortable temperatures returning",
      "mild and dry, one of the coolest and most pleasant months"
    ], searchAliases: ['Cairo', 'Luxor', 'Aswan', 'Pyramids', 'Giza'] },
  { id: 'maldives', name: 'Maldives', region: 'Indian Ocean', emoji: '🐠', climate: 'tropical',
    about: 'Dry season Dec–Apr has the calmest seas and best visibility (and the highest prices); wet season is windier but still sunny between showers.',
    base: { sunbathing:9, swimming:9, diving:10, surfing:5, sailing:6, hiking:1, scenic:6, fishing:6, roadtrip:1, adventure:3, golf:1, stargazing:6, museums:1, architecture:1, festivals:1, finedining:6, streetfood:2, nightlife:2, winetasting:2, spa:9, snowsports:0, cycling:1, shopping:2, birding:5, wildlife:5 },
    activityStyleTiers: { scenic: { coastlines: 'strong', astrophotography: 'casual', mountains: 'none', forests: 'none', deserts: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded'], physicalBands: ['easy','moderate'],
    dry: [12,1,2,3,4], wet: [5,6,7,8,9,10,11], peak: [12,1,2,3], low: [5,6,10,11], naSliders: ['snowsports', 'museums', 'architecture', 'festivals'],
    monthlyWeather: [
      "dry, sunny, and calm, with the northeast monsoon in full swing",
      "dry and sunny, among the calmest, most reliable months of the year",
      "warm, dry, and the sunniest stretch of the year",
      "hot and dry, with the dry season winding down by month's end",
      "transitioning to wet, warmer with wind and rain picking up",
      "breezier and wetter, as the southwest monsoon sets in",
      "windier with regular squalls, though sunny spells remain common",
      "still breezy and unsettled, deep in the wet season",
      "the wettest month, with frequent but usually brief downpours",
      "rain gradually easing as the monsoon begins to transition",
      "warming and drying out, with calmer seas returning",
      "dry, sunny, and calm, as the northeast monsoon sets back in"
    ], searchAliases: ['Male', 'Malé'] },
  { id: 'srilanka', name: 'Sri Lanka', region: 'South Asia', emoji: '🍃', climate: 'tropical',
    about: 'Two monsoons split the island: this (more-visited) coast is driest Dec–Mar. The east coast runs the opposite calendar — best May–Sep.',
    base: { sunbathing:7, swimming:7, diving:6, surfing:6, sailing:4, hiking:7, scenic:8, fishing:4, roadtrip:5, adventure:4, golf:2, stargazing:4, museums:7, architecture:7, festivals:7, finedining:6, streetfood:8, nightlife:4, winetasting:1, spa:7, snowsports:0, cycling:3, shopping:5, birding:5, wildlife:8 },
    activityStyleTiers: { scenic: { coastlines: 'strong', forests: 'casual', mountains: 'none', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['easygoing','secluded'], physicalBands: ['easy','moderate','active'],
    dry: [12,1,2,3], wet: [5,6,7,8,9], peak: [12,1,2], low: [5,6,9], swimHazard: [6,7,8],
    hikingBest: [12,1,2,3,4,5], hikingWorst: [6,7,8,9], wildlifePeak: [2,3,4,5,6,11,12,1], sliderCaps: { wildlife: 9 }, sliderEvents: { birding: [
      { label: 'Northern-winter migrant arrivals', weight: 4, months: { 1: 1, 2: 1, 3: 0.6, 11: 0.4, 12: 0.85 } },
    ] }, naSliders: ['snowsports', 'winetasting'],
    monthlyWeather: [
      "dry and warm, one of the best months on this coast",
      "dry and warm, calm seas and reliable sunshine",
      "dry and warming, with humidity starting to build ahead of the monsoon",
      "hot and increasingly humid, just before the rains arrive",
      "the southwest monsoon arrives, humid with heavy afternoon downpours",
      "humid and rainy, with frequent squalls and rough seas",
      "humid and wet, still deep in the monsoon on this coast",
      "humid with rain easing slightly, though still unsettled",
      "rain tapering off, humid with improving conditions late in the month",
      "transitional and unsettled, with showers from the shifting monsoon",
      "the second monsoon brushes this coast lightly, mild with scattered showers",
      "dry and warming, as the best stretch of the season begins"
    ], searchAliases: ['Colombo', 'Galle', 'Kandy', 'Ella'] },
  { id: 'vietnam', name: 'Vietnam', region: 'Southeast Asia', emoji: '🚣', climate: 'tropical',
    about: 'Climate varies sharply north-to-south; this is a rough whole-country average. Typhoon risk rises Sep–Nov, especially central/north.',
    base: { sunbathing:6, swimming:6, diving:5, surfing:3, sailing:5, hiking:6, scenic:6, fishing:3, roadtrip:6, adventure:4, golf:3, stargazing:3, museums:6, architecture:7, festivals:6, finedining:7, streetfood:10, nightlife:7, winetasting:1, spa:6, snowsports:0, cycling:5, shopping:8, birding:6, wildlife:3 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'strong', gravelRiding: 'casual', mountainBiking: 'none' }, scenic: { coastlines: 'strong', forests: 'casual', mountains: 'casual', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate','active'],
    dry: [2,3,4], wet: [9,10,11], peak: [12,1,2,3], low: [9,10,11], swimHazard: [9,10],
    birdingPeak: [11,12,1,2,3], sliderCaps: { birding: 7 }, sliderEvents: { scenic: [
      { label: 'Dry-season clarity', weight: 2.5, months: { 2: 0.6, 3: 1, 4: 0.85 } },
    ] }, naSliders: ['snowsports', 'winetasting'],
    monthlyWeather: [
      "cool and dry in the north, warm and dry in the south",
      "cool and dry in the north, warm and mostly dry farther south",
      "warming up in the north, hot and dry in the south",
      "warm and humid in the north, hot with the south's dry season peaking",
      "hot and increasingly wet nationwide, as the rainy season begins",
      "hot and humid, with regular rain across most of the country",
      "hot and rainy, especially in the north and south",
      "hot and humid, still deep in the rainy season nationwide",
      "hot and wet, with typhoon risk rising in the central and northern regions",
      "rain easing in the south, still unsettled with typhoon risk in the center and north",
      "cooling and drying in the north, still warm and increasingly dry farther south",
      "cool and dry in the north, warm and dry in the south"
    ], searchAliases: ['Hanoi', 'Hoi An', 'Ho Chi Minh City', 'Saigon', 'Halong Bay'] },
  { id: 'japan', name: 'Japan', region: 'East Asia', emoji: '🌸', climate: 'temperate',
    about: 'Cherry blossoms (Mar–Apr) and fall foliage (Oct–Nov) are the celebrated, crowded peaks. Rainy season hits June, typhoons Aug–Sep.',
    base: { sunbathing:3, swimming:3, diving:4, surfing:3, sailing:3, hiking:7, scenic:6, fishing:4, roadtrip:6, adventure:4, golf:6, stargazing:4, museums:9, architecture:9, festivals:5, finedining:10, streetfood:10, nightlife:8, winetasting:3, spa:8, snowsports:7, cycling:5, shopping:8, birding:6, wildlife:4 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'strong', gravelRiding: 'casual', mountainBiking: 'casual' }, scenic: { mountains: 'strong', forests: 'signature', coastlines: 'casual', deserts: 'none', astrophotography: 'casual' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate','active'],
    dry: [3,4,10,11], wet: [6,9], peak: [3,4,10,11], peakIntensity: 'extreme', low: [1,2],
    hikingBest: [4,5,10,11], hikingWorst: [6,7,8], birdingPeak: [1,2,10,11], wildlifePeak: [1,2,3], sliderCaps: { wildlife: 5, birding: 6 }, sliderEvents: { scenic: [
      { label: 'Cherry blossoms', weight: 3, months: { 3: 0.7, 4: 1 } },
      { label: 'Autumn foliage', weight: 3, months: { 10: 0.7, 11: 1 } },
    ], festivals: [
      { label: 'Summer matsuri season', weight: 5, months: { 7: 0.7, 8: 1 } },
    ] }, specialSeasons: [{ months: [3,4], text: "Cherry blossoms (sakura) are in bloom — one of the most celebrated, and crowded, times to visit." }, { months: [10,11], text: "Fall foliage (koyo) is at its peak across much of the country." }],
    monthlyWeather: [
      "cold and dry, with clear skies common across most of the country",
      "still cold, though the first plum blossoms hint at spring",
      "mild and warming fast, with cherry blossoms beginning in the south",
      "mild and one of the most popular months, as cherry blossoms peak nationwide",
      "warm and comfortable, generally the last easy month before the rains",
      "the rainy season settles in, humid with frequent overcast days and downpours",
      "hot and intensely humid, with the mugginess as much a factor as the heat",
      "the hottest month, oppressively humid with the first typhoon risk building",
      "still warm and humid, with typhoon season at its peak",
      "cooling and drying out, with clearer skies and lingering typhoon risk",
      "crisp and mild, with fall foliage at its best",
      "cold and dry, with clear winter skies returning"
    ], searchAliases: ['Tokyo', 'Kyoto', 'Osaka', 'Mount Fuji'] },
  { id: 'nz', name: 'New Zealand', region: 'Oceania', emoji: '🥝', climate: 'temperate',
    about: 'Southern Hemisphere summer (Dec–Feb) is peak for the Great Walks and beaches; many alpine trails/huts close in winter (Jun–Aug).',
    base: { sunbathing:6, swimming:5, diving:5, surfing:6, sailing:6, hiking:5, scenic:7, fishing:6, roadtrip:9, adventure:8, golf:5, stargazing:6, museums:4, architecture:3, festivals:3, finedining:6, streetfood:4, nightlife:4, winetasting:6, spa:4, snowsports:7, cycling:6, shopping:4, birding:6, wildlife:7 },
    activityStyleTiers: { cycling: { mountainBiking: 'strong', gravelRiding: 'strong', scenicRoadCycling: 'casual' }, scenic: { mountains: 'strong', coastlines: 'strong', forests: 'strong', astrophotography: 'strong' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate','active','challenging'],
    dry: [12,1,2,3], wet: [6,7,8], peak: [12,1,2], low: [6,7],
    hikingBest: [12,1,2,3], hikingWorst: [6,7,8], wildlifePeak: [10,11,12,1,2], sliderCaps: { wildlife: 8 },
    sliderEvents: { hiking: [
      { label: 'Great Walks season', weight: 4, months: { 1: 1, 2: 1, 3: 0.6, 12: 0.85 } },
    ], scenic: [
      { label: 'Summer clarity', weight: 2.5, months: { 1: 1, 2: 1, 3: 0.5, 12: 0.7 } },
    ], winetasting: [
      { label: 'Marlborough harvest season', weight: 1.5, months: { 3: 0.5, 4: 0.7 } },
    ] }, monthlyWeather: [
      "warm and one of the sunniest months, peak summer for beaches and the Great Walks",
      "warm and dry, typically the warmest month of the year",
      "mild and still pleasant, with the first hints of autumn color",
      "cool and crisp, with golden autumn light in the alpine valleys",
      "cool and increasingly wet, as many alpine trails start closing",
      "cold, with snow settling into the Southern Alps",
      "the coldest month, with ski season in full swing",
      "cold and often wet, still deep in ski season",
      "cool, with weather that can swing from sun to rain within the same day as spring sets in",
      "mild and still unpredictable, with alpine huts and trails starting to reopen",
      "mild and increasingly warm, one of the more pleasant months",
      "warm and sunny, with summer building toward its peak"
    ], searchAliases: ['Auckland', 'Milford Sound', 'New Zealand'] },
  { id: 'galapagos', name: 'Galápagos Islands', region: 'Ecuador', emoji: '🐢', climate: 'tropical',
    about: 'Genuinely a year-round wildlife destination — warm/calm Dec–May vs. cooler nutrient-rich "garua" season Jun–Nov just shift which species shine.',
    base: { sunbathing:6, swimming:8, diving:9, surfing:2, sailing:6, hiking:6, scenic:8, fishing:4, roadtrip:2, adventure:4, golf:1, stargazing:5, museums:2, architecture:1, festivals:1, finedining:3, streetfood:2, nightlife:1, winetasting:1, spa:3, snowsports:0, cycling:2, shopping:2, birding:8, wildlife:9 },
    activityStyleTiers: { scenic: { coastlines: 'strong', deserts: 'casual', astrophotography: 'casual', mountains: 'none', forests: 'none' } },
    budgetBands: ['highend','luxury'], vibeBands: ['secluded'], physicalBands: ['easy','moderate','active'],
    dry: [6,7,8,9,10,11], wet: [1,2,3,4], peak: [6,7,8,12,1], low: [4,5,9],
    sliderEvents: { wildlife: [
      { label: 'Nutrient-rich garua-season marine activity', weight: 1, months: { 7: 0.7, 8: 1, 9: 1, 10: 0.7 } },
    ], birding: [
      { label: 'Seabird breeding season (garua)', weight: 1.2, months: { 4: 0.4, 5: 0.7, 6: 1, 7: 1, 8: 1, 9: 0.6 } },
    ] }, naSliders: ['snowsports', 'architecture', 'festivals', 'nightlife', 'winetasting'],
    monthlyWeather: [
      "warm and increasingly sunny, with the wet season beginning",
      "warm and sunny, with the year's warmest sea temperatures approaching",
      "hot and sunny, with brief afternoon showers common",
      "hot and sunny, the last full month of the warm season",
      "warm, with the garúa mist starting to roll in by month's end",
      "cooler and misty, as the garúa season sets in with foggy mornings",
      "cool and often foggy, with drizzly mornings and dry afternoons",
      "cool and misty, still deep in garúa season with nutrient-rich seas",
      "cool and overcast, among the mistiest months of the year",
      "cool and misty, though afternoons often clear",
      "warming up, with the garúa mist beginning to lift",
      "warm and sunny, as the wet season returns"
    ], searchAliases: ['Ecuador', 'Santa Cruz Island'] },
  { id: 'peru', name: 'Cusco & Sacred Valley', region: 'Peru', emoji: '🏔️', climate: 'highland',
    about: 'Dry season May–Sep is prime trekking, with Jun–Aug the busiest. The Inca Trail closes entirely every February for maintenance.',
    base: { sunbathing:3, swimming:2, diving:1, surfing:1, sailing:1, hiking:4, scenic:6, fishing:3, roadtrip:6, adventure:6, golf:1, stargazing:6, museums:9, architecture:9, festivals:7, finedining:8, streetfood:7, nightlife:5, winetasting:3, spa:4, snowsports:1, cycling:4, shopping:6, birding:5, wildlife:4 },
    activityStyleTiers: { cycling: { mountainBiking: 'strong', scenicRoadCycling: 'casual', gravelRiding: 'casual' }, scenic: { mountains: 'signature', forests: 'strong', deserts: 'casual', coastlines: 'none', astrophotography: 'strong' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['easygoing','secluded'], physicalBands: ['moderate','active','challenging'],
    dry: [5,6,7,8,9], wet: [12,1,2,3], peak: [6,7,8], peakIntensity: 'mild', low: [12,1,2,3],
    hikingBest: [5,6,7,8,9], hikingWorst: [1,2,12], wildlifePeak: [5,6,7,8,9], sliderCaps: { wildlife: 5 }, sliderEvents: { birding: [
      { label: 'Dry-season trekking visibility', weight: 3.5, months: { 5: 0.4, 6: 0.7, 7: 1, 8: 1, 9: 0.6 } },
    ], hiking: [
      { label: 'Dry-season trekking', weight: 5, months: { 5: 0.6, 6: 0.85, 7: 1, 8: 1, 9: 0.7 } },
    ], scenic: [
      { label: 'Dry-season clarity', weight: 3, months: { 5: 0.5, 6: 0.7, 7: 0.85, 8: 0.85, 9: 0.6 } },
    ] }, specialSeasons: [{ months: [2], text: "The Inca Trail is closed all month for annual maintenance — other treks and Machu Picchu itself stay open." }], naSliders: ['snowsports', 'surfing', 'diving', 'sailing'],
    monthlyWeather: [
      "rainy and mild by day, with cold nights at altitude",
      "the wettest month, mild with the Inca Trail closed for maintenance",
      "still rainy, though showers begin easing as the month progresses",
      "drying out fast, mild days with clear skies increasingly common",
      "dry and mild, one of the best months before peak season",
      "dry and cold at night, with temperatures often dropping to freezing after dark",
      "the coldest month, dry with freezing nights and crisp, clear days",
      "dry and cold at night, still deep in the busiest trekking season",
      "dry and mild, with nights slowly warming",
      "mild, with the first rains of the season returning",
      "increasingly wet, mild by day with rain becoming regular",
      "rainy and mild, with wet-season showers most afternoons"
    ], searchAliases: ['Machu Picchu', 'Cusco', 'Sacred Valley'] },
  { id: 'rivieramaya', name: 'Riviera Maya', region: 'Mexico', emoji: '🌊', climate: 'tropical',
    about: 'Dry season Nov–Apr is warm and comfortable; hurricane risk peaks Aug–Oct. Whale sharks gather near Isla Mujeres Jun–Sep.',
    base: { sunbathing:8, swimming:9, diving:9, surfing:3, sailing:6, hiking:3, scenic:5, fishing:5, roadtrip:4, adventure:5, golf:6, stargazing:4, museums:5, architecture:4, festivals:4, finedining:7, streetfood:8, nightlife:8, winetasting:2, spa:7, snowsports:0, cycling:3, shopping:6, birding:6, wildlife:6 },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively','highenergy'], physicalBands: ['easy','moderate'],
    dry: [11,12,1,2,3,4], wet: [6,7,8,9], peak: [12,1,2,3], low: [9,10], swimHazard: [8,9,10],
    wildlifePeak: [6,7,8,9], sliderCaps: { wildlife: 7 }, specialSeasons: [{ months: [6,7,8,9], text: "Whale sharks gather to feed near Isla Mujeres and Holbox, one of the largest aggregations on Earth." }], naSliders: ['snowsports'],
    monthlyWeather: [
      "dry and warm, with the year's lowest humidity",
      "dry and warm, one of the most comfortable months",
      "dry and warm, with heat building toward summer",
      "warm and mostly dry, one of the best months before the heat and rain set in",
      "hot and increasingly humid, as the dry season winds down",
      "hot and humid, with the wet season beginning and whale sharks arriving",
      "hot and humid, with brief but heavy afternoon showers",
      "hot and humid, deep in whale shark season with regular afternoon storms",
      "hot and humid, the peak of hurricane season with the year's heaviest rain",
      "hot and humid, still within hurricane season with unsettled weather",
      "warm and drying out, with hurricane risk fading",
      "dry and warm, one of the most pleasant months of the year"
    ], searchAliases: ['Cancun', 'Tulum', 'Playa del Carmen', 'Cozumel'] },
  { id: 'madagascar', name: 'Madagascar', region: 'East Africa', emoji: '🦎', climate: 'tropical',
    about: 'Dry season Apr–Nov is far easier for lemur trekking and road travel; cyclone risk peaks Jan–Mar with some areas cut off.',
    base: { sunbathing:5, swimming:5, diving:5, surfing:3, sailing:3, hiking:7, scenic:7, fishing:3, roadtrip:5, adventure:4, golf:1, stargazing:6, museums:2, architecture:2, festivals:3, finedining:3, streetfood:4, nightlife:2, winetasting:1, spa:3, snowsports:0, cycling:3, shopping:3, birding:6, wildlife:5 },
    activityStyleTiers: { scenic: { forests: 'strong', coastlines: 'strong', mountains: 'casual', deserts: 'casual', astrophotography: 'casual' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['secluded'], physicalBands: ['moderate','active'],
    dry: [5,6,7,8,9,10], wet: [12,1,2,3], peak: [7,8,9,10], peakIntensity: 'mild', low: [12,1,2,3],
    hikingBest: [5,6,7,8,9,10], hikingWorst: [1,2,3], sliderEvents: { wildlife: [
      { label: 'Dry-season lemur trekking & road access', weight: 4, months: { 4: 0.5, 5: 0.7, 6: 1, 7: 1, 8: 1, 9: 1, 10: 0.85, 11: 0.5 } },
    ], birding: [
      { label: 'Dry-season access', weight: 3.5, months: { 4: 0.4, 5: 0.6, 6: 1, 7: 1, 8: 1, 9: 1, 10: 0.8, 11: 0.4 } },
    ] }, naSliders: ['snowsports', 'winetasting'],
    monthlyWeather: [
      "hot and wet, with cyclone risk at its highest",
      "hot and wet, the peak of cyclone season with the heaviest rain",
      "hot and rainy, still within cyclone season though risk begins easing",
      "warm and rainy early on, drying out as the month progresses",
      "mild and increasingly dry, one of the best months for travel",
      "the coolest month, dry with pleasant days for lemur trekking",
      "cool and dry, comfortable conditions across most of the island",
      "mild and dry, one of the best months for wildlife viewing",
      "warming up, dry with easy road travel",
      "warm and dry, still comfortable before the rains return",
      "hot, with the first rains returning and cyclone risk building",
      "hot and wet, the warmest month with rains fully underway"
    ], searchAliases: ['Antananarivo', 'lemurs'] },
  { id: 'ranthambore', name: 'Ranthambore & Rajasthan', region: 'India', emoji: '🐅', climate: 'desert',
    about: 'The tiger reserve closes entirely Jul–Sep for monsoon. Apr–Jun is brutally hot but gives the best tiger sightings as vegetation thins.',
    base: { sunbathing:1, swimming:1, diving:1, surfing:1, sailing:1, hiking:2, scenic:6, fishing:1, roadtrip:5, adventure:2, golf:2, stargazing:5, museums:9, architecture:10, festivals:7, finedining:6, streetfood:8, nightlife:3, winetasting:1, spa:5, snowsports:0, cycling:2, shopping:9, birding:7, wildlife:5 },
    activityStyleTiers: { scenic: { deserts: 'strong', forests: 'casual', mountains: 'none', coastlines: 'none', astrophotography: 'none' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing'], physicalBands: ['easy','moderate'],
    dry: [10,11,12,1,2,3], wet: [], hot: [4,5,6], peak: [11,12,1,2], low: [10,3],
    wildlifeClosed: [7,8,9], birdingPeak: [10,11,12,1,2], sliderCaps: { birding: 7 }, sliderEvents: { wildlife: [
      { label: 'Tiger sightings (thinning dry-season vegetation)', weight: 4, months: { 3: 0.5, 4: 0.85, 5: 1, 6: 1 } },
    ] }, specialSeasons: [{ months: [3,4,5,6], text: "Thinning vegetation as the dry season peaks makes this the best window for tiger sightings." }], naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'sailing', 'winetasting'],
    monthlyWeather: [
      "cold, especially at night, with crisp, clear days for tiger spotting",
      "mild by day but still cold at night, comfortable for game drives",
      "warming up fast, dry with pleasant days",
      "hot and dry, though still comfortable enough for morning safaris",
      "scorching and dry, with animals drawn to shrinking waterholes",
      "extremely hot and dry, right before the monsoon breaks",
      "hot and humid as the monsoon arrives",
      "hot and rainy, deep in the monsoon",
      "hot and humid, still unsettled as the monsoon lingers",
      "warm and drying out, with skies clearing again",
      "mild and pleasant, one of the best months for wildlife viewing",
      "cold, especially at night, with clear skies and crisp mornings"
    ], searchAliases: ['Rajasthan', 'Jaipur', 'Udaipur'] },
);
RAW_DESTINATIONS.push(
  { id: 'antarctica', name: 'Antarctic Peninsula', region: 'Antarctica', emoji: '🐧', climate: 'polar',
    about: 'Cruises run Nov–Mar only. Dec–Jan brings penguin chicks and 24hr daylight; Feb–Mar is best for whales as ice retreats.',
    base: { sunbathing:0, swimming:0, diving:2, surfing:0, sailing:3, hiking:3, scenic:8, fishing:1, roadtrip:1, adventure:3, golf:0, stargazing:1, museums:1, architecture:1, festivals:1, finedining:3, streetfood:1, nightlife:1, winetasting:1, spa:2, snowsports:1, cycling:0, shopping:0, birding:7, wildlife:8 },
    activityStyleTiers: { scenic: { mountains: 'signature', coastlines: 'signature', forests: 'none', deserts: 'none', astrophotography: 'casual' } },
    budgetBands: ['highend','luxury'], vibeBands: ['secluded'], physicalBands: ['moderate','active','challenging'],
    dry: [], wet: [], cold: [4,5,6,7,8,9,10], peak: [12,1], low: [11],
    birdingPeak: [11,12,1], sliderEvents: { wildlife: [
      { label: 'Penguin chicks & retreating ice (whales)', weight: 2, months: { 11: 0.5, 12: 1, 1: 1, 2: 0.85, 3: 0.85 } },
    ], scenic: [
      { label: 'Peak season light & wildlife spectacle', weight: 2, months: { 1: 1, 2: 0.85, 3: 0.85, 11: 0.5, 12: 1 } },
    ], stargazing: [
      { label: 'Shoulder-season partial darkness', weight: 3, months: { 2: 0.7, 3: 0.7, 11: 1 } },
    ] }, inaccessible: [4,5,6,7,8,9,10], specialSeasons: [{ months: [12,1], text: "Penguin chicks are hatching and daylight is nearly round-the-clock." }, { months: [2,3], text: "As sea ice retreats, whale sightings become more frequent." }], naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'golf', 'cycling', 'museums', 'architecture', 'festivals', 'nightlife', 'shopping', 'winetasting'],
    monthlyWeather: [
      "warm by Antarctic standards, with nearly round-the-clock daylight and mild conditions around 0°C",
      "mild for the region, around freezing, with ice retreating and whale sightings increasing",
      "cooling as the season winds down, with dramatic light and quieter seas",
      "deep into polar winter, with temperatures well below freezing and near-total darkness",
      "polar winter, dark and frozen with the peninsula locked in sea ice",
      "the heart of polar winter, extremely cold with 24-hour darkness",
      "still deep winter, bitterly cold with the sea ice at its most extensive",
      "polar winter continues, extremely cold with ice beginning to show early cracks",
      "still frozen and dark, though the sun starts returning toward month's end",
      "cold and icy, with the sea ice beginning to break up as the season approaches",
      "cold, around -2 to 0°C, with the most extensive sea ice of the season and dramatic icescapes",
      "mild for the region, near freezing, with penguin chicks hatching and daylight nearly constant"
    ], searchAliases: ['South Georgia', 'penguins'] },
  { id: 'alaska', name: 'Alaska', region: 'USA', emoji: '🐻', climate: 'temperate',
    about: 'Cruises, lodges and bear-viewing operate May–Sep, peaking Jun–Aug. Winter is a completely different trip built around aurora viewing.',
    base: { sunbathing:2, swimming:1, diving:3, surfing:1, sailing:5, hiking:3, scenic:7, fishing:9, roadtrip:9, adventure:6, golf:1, stargazing:2, museums:3, architecture:2, festivals:3, finedining:4, streetfood:3, nightlife:3, winetasting:1, spa:4, snowsports:3, cycling:3, shopping:3, birding:5, wildlife:1 },
    activityStyleTiers: { scenic: { mountains: 'signature', forests: 'strong', coastlines: 'strong', deserts: 'none', astrophotography: 'strong' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded','easygoing'], physicalBands: ['moderate','active','challenging'],
    dry: [6,7,8], wet: [], cold: [10,11,12,1,2,3], peak: [6,7,8], low: [5,9],
    hikingBest: [6,7,8], hikingWorst: [10,11,12,1,2,3,4], birdingPeak: [5,6,7], sliderCaps: { birding: 7 }, sliderEvents: { wildlife: [
      { label: 'Bear viewing (salmon runs)', weight: 7, months: { 5: 0.4, 6: 1, 7: 1, 8: 1, 9: 0.4 } },
    ], hiking: [
      { label: 'Summer trail access', weight: 6, months: { 6: 0.85, 7: 1, 8: 0.85 } },
    ], scenic: [
      { label: 'Peak summer clarity', weight: 2.5, months: { 6: 0.6, 7: 0.85, 8: 0.6 } },
    ], stargazing: [
      { label: 'Long winter darkness (aurora season)', weight: 6, months: { 1: 1, 2: 0.85, 3: 0.6, 4: 0.3, 5: 0.15, 9: 0.3, 10: 0.6, 11: 0.85, 12: 1 } },
    ] }, specialSeasons: [{ months: [6,7,8], text: "This is peak bear-viewing season, timed to the salmon runs." }, { months: [10,11,12,1,2,3,4], text: "Long, dark nights make this aurora season — a completely different trip from summer's wildlife viewing." }], naSliders: ['swimming', 'surfing', 'winetasting'],
    monthlyWeather: [
      "deep winter, cold and dark with aurora season in full swing",
      "cold and snowy, still prime for aurora viewing under long, dark nights",
      "cold but brightening, with daylight lengthening and aurora chances continuing",
      "cool and transitional, with snow lingering and daylight increasing fast",
      "cool and the driest month, with wildlife emerging and long daylight returning",
      "mild with nearly 24-hour daylight, one of the best months for wildlife",
      "the warmest month, mild with peak bear-viewing along the salmon runs",
      "still mild, with rain becoming more frequent as the month progresses",
      "cooling and increasingly wet, with the last of the wildlife season and early aurora returning",
      "cold with dark nights returning, as aurora season begins",
      "cold and dark, deep into aurora season with long nights",
      "the coldest, darkest month, prime for aurora under nearly round-the-clock darkness"
    ], searchAliases: ['Denali', 'Anchorage', 'Juneau'] },
  { id: 'gbr', name: 'Great Barrier Reef', region: 'Queensland, Australia', emoji: '🐡', climate: 'tropical',
    about: 'Dry season (May–Oct) has the best visibility and — importantly — no dangerous stinger jellyfish in open water. Wet season (Nov–Apr) requires stinger suits to swim.',
    base: { sunbathing:8, swimming:8, diving:10, surfing:5, sailing:8, hiking:6, scenic:8, fishing:6, roadtrip:6, adventure:6, golf:4, stargazing:5, museums:3, architecture:2, festivals:3, finedining:5, streetfood:5, nightlife:5, winetasting:3, spa:5, snowsports:0, cycling:4, shopping:5, birding:6, wildlife:8 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' }, scenic: { coastlines: 'strong', forests: 'casual', mountains: 'none', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate','active'],
    dry: [5,6,7,8,9,10], wet: [1,2,3], peak: [6,7,8,9], low: [1,2,3], swimHazard: [11,12,1,2,3,4,5],
    wildlifePeak: [6,7,8,9], specialSeasons: [{ months: [11,12,1,2,3,4], text: "Dangerous stinger jellyfish are present in the water — swimming requires a protective stinger suit." }], naSliders: ['snowsports'],
    monthlyWeather: [
      "hot, humid, and wet, with stinger jellyfish present in the water",
      "hot and humid, the wettest month with stinger suits required for swimming",
      "hot and humid, still within stinger season with regular rain",
      "warm and humid, rain easing as the wet season winds down",
      "warm and drying out, with the trade winds returning and stingers clearing",
      "mild and dry, with clear skies and the best visibility of the year",
      "mild and dry, consistent trade winds and excellent diving conditions",
      "mild and dry, one of the best months for reef visibility",
      "warm and dry, still ideal conditions with steady trade winds",
      "warm and dry, the last of the stinger-free season before wet season returns",
      "hot and humid, with the wet season beginning and stingers returning",
      "hot, humid, and increasingly wet, with cyclone risk building"
    ], searchAliases: ['Cairns', 'Whitsundays', 'Queensland'] },
  { id: 'namibia', name: 'Namibia', region: 'Southern Africa', emoji: '🏜️', climate: 'desert',
    about: 'Dry season May–Oct concentrates wildlife at waterholes for classic sightings; wet season Nov–Apr brings dramatic skies and migratory birds.',
    base: { sunbathing:3, swimming:1, diving:1, surfing:2, sailing:1, hiking:7, scenic:8, fishing:3, roadtrip:9, adventure:5, golf:1, stargazing:9, museums:2, architecture:2, festivals:2, finedining:3, streetfood:2, nightlife:2, winetasting:1, spa:3, snowsports:0, cycling:2, shopping:3, birding:5, wildlife:7 },
    activityStyleTiers: { scenic: { deserts: 'signature', astrophotography: 'strong', mountains: 'none', forests: 'none', coastlines: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded'], physicalBands: ['moderate','active','challenging'],
    dry: [5,6,7,8,9,10], wet: [12,1,2,3], peak: [7,8,9], peakIntensity: 'mild', low: [1,2,11],
    hikingBest: [5,6,7,8,9], hikingWorst: [1,2,12], sliderEvents: { wildlife: [
      { label: 'Dry-season concentration', weight: 3, months: { 5: 0.4, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 0.6 } },
    ], birding: [
      { label: 'Wet-season migratory bird arrivals', weight: 4, months: { 1: 1, 2: 1, 3: 0.6, 11: 0.4, 12: 0.85 } },
    ], scenic: [
      { label: 'Dry-season desert light', weight: 1, months: { 5: 0.4, 6: 0.6, 7: 0.7, 8: 0.7, 9: 0.6 } },
    ] }, naSliders: ['snowsports', 'swimming', 'diving', 'sailing', 'winetasting'],
    monthlyWeather: [
      "hot and increasingly wet, with unpredictable summer showers",
      "hot and humid for a desert, with the summer rains at their heaviest",
      "hot, with rain tapering off as the month progresses",
      "warm and drying out, one of the best transition months",
      "mild and dry, with the dry season settling in",
      "mild by day but cold at night, dry with clear desert skies",
      "the coldest month, dry with near-freezing nights in the desert",
      "cool at night but mild by day, dry with wildlife concentrating at waterholes",
      "warming up, dry with excellent wildlife viewing at waterholes",
      "hot and dry, still excellent for wildlife before the rains return",
      "hot, with the first rains beginning in the northeast",
      "hot and increasingly wet, with the summer rains building"
    ], searchAliases: ['Sossusvlei', 'Etosha', 'Skeleton Coast'] },
  { id: 'patagonia', name: 'Patagonia', region: 'Chile & Argentina', emoji: '🏔️', climate: 'temperate',
    about: 'Trekking season (Torres del Paine, El Chaltén) runs Nov–Mar when trails/refugios are open; winter shuts much of the infrastructure down.',
    base: { sunbathing:2, swimming:1, diving:1, surfing:2, sailing:3, hiking:4, scenic:6, fishing:6, roadtrip:9, adventure:8, golf:1, stargazing:7, museums:2, architecture:2, festivals:2, finedining:4, streetfood:3, nightlife:2, winetasting:3, spa:3, snowsports:4, cycling:3, shopping:3, birding:6, wildlife:8 },
    activityStyleTiers: { scenic: { mountains: 'signature', coastlines: 'strong', forests: 'strong', deserts: 'casual', astrophotography: 'strong' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded'], physicalBands: ['moderate','active','challenging'],
    dry: [11,12,1,2,3], wet: [6,7,8], peak: [12,1,2], low: [6,7,8],
    hikingBest: [11,12,1,2,3], hikingWorst: [6,7,8], wildlifePeak: [9,10,11,12,1,2,3,4], sliderEvents: { hiking: [
      { label: 'Trails & refugios open', weight: 4.5, months: { 1: 1, 2: 1, 3: 0.6, 11: 0.5, 12: 1 } },
    ], scenic: [
      { label: 'Peak trekking-season access', weight: 3, months: { 1: 1, 2: 1, 3: 0.6, 11: 0.5, 12: 1 } },
    ] }, naSliders: ['swimming', 'diving'],
    monthlyWeather: [
      "warming up fast, with wind picking up toward its summer peak",
      "warm by Patagonian standards but the year's windiest month, with regular gusts over 40mph",
      "still windy, but a touch calmer and less crowded than January",
      "winds ease and colors start turning as the summer crowds thin out",
      "cool and increasingly quiet, with the first snow dusting the peaks",
      "cold and often wet, with many trekking huts closing for the season",
      "cold and snowy, deep winter with short daylight hours",
      "the coldest month, with heavy snow at higher elevations",
      "still deep winter, cold and quiet with limited services",
      "cold and blustery again as wind starts building back",
      "cool with building winds, trails reopening but still unpredictable",
      "winds strengthen and the weather turns famously changeable, sun then hail then sun again"
    ], searchAliases: ['Torres del Paine', 'El Calafate', 'El Chalten', 'Chile', 'Argentina'] },
  { id: 'barbados', name: 'Barbados', region: 'Eastern Caribbean', emoji: '🌺', climate: 'tropical',
    about: 'Dry season Dec–Apr is classic Caribbean winter-sun. Hurricane season runs Jun–Nov, with risk peaking Aug–Oct.',
    base: { sunbathing:9, swimming:9, diving:6, surfing:5, sailing:8, hiking:3, scenic:5, fishing:6, roadtrip:3, adventure:3, golf:6, stargazing:3, museums:3, architecture:3, festivals:6, finedining:7, streetfood:6, nightlife:6, winetasting:3, spa:6, snowsports:0, cycling:3, shopping:5, birding:5, wildlife:4 },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [12,1,2,3,4], wet: [6,7,8,9,10,11], peak: [12,1,2,3], low: [9,10], swimHazard: [8,9,10],
    wildlifePeak: [6,7,8,9], sliderCaps: { wildlife: 4 }, naSliders: ['snowsports'],
    monthlyWeather: [
      "dry and warm, one of the most pleasant months of the year",
      "dry and warm, among the driest months with reliable sunshine",
      "dry and warm, still one of the best months to visit",
      "warm and mostly dry, with rain starting to return by month's end",
      "warm and increasingly humid, as the wet season begins",
      "warm and breezy, the windiest month with building trade winds",
      "warm and humid, with hurricane season now underway",
      "hot and humid, with regular showers and hurricane risk present",
      "hot and humid, the peak of hurricane season though direct hits are rare",
      "hot and humid, still within hurricane season with the year's heaviest rain",
      "warm and humid, with rain easing as hurricane season winds down",
      "dry and warm, one of the most pleasant months as the dry season returns"
    ], searchAliases: ['Bridgetown'] },
  { id: 'paris', name: 'Paris', region: 'France', emoji: '🗼', climate: 'temperate',
    about: 'A year-round city break; late spring and early fall are the sweet spot. Summer is hot and packed (some small restaurants close mid-August); winter is grey but atmospheric, with Christmas markets.',
    base: { sunbathing:1, swimming:1, diving:1, surfing:1, sailing:1, hiking:2, scenic:4, fishing:1, roadtrip:3, adventure:1, golf:3, stargazing:1, museums:10, architecture:10, festivals:6, finedining:10, streetfood:7, nightlife:8, winetasting:7, spa:5, snowsports:0, cycling:6, shopping:9, birding:2, wildlife:1 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'strong', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [4,5,6,9,10], wet: [11,12,1,2], hot: [8], peak: [6,7,8], low: [11,1,2], sliderEvents: { festivals: [
      { label: 'Christmas markets', weight: 3, months: { 12: 1 } },
    ] }, specialSeasons: [{ months: [12], text: "Christmas markets and holiday lights fill the city, especially along the Champs-Élysées." }], naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'sailing'],
    monthlyWeather: [
      "cold and grey, the coldest month with short days",
      "cold and still grey, though days are slowly lengthening",
      "cool and fresh, with spring arriving in fits and starts",
      "mild and often rainy, with the city turning green",
      "mild and increasingly pleasant, one of the best months for sightseeing",
      "warm and sunny, with long, pleasant evenings",
      "warm and mostly sunny, though can bring occasional heatwaves",
      "hot, with many small restaurants and shops closing as locals leave the city",
      "warm and comfortable, one of the best months as the city regains its rhythm",
      "cool and mild, with autumn color settling in",
      "cool and grey, with rain becoming more frequent",
      "cold, with short days and a festive atmosphere around the holidays"
    ], searchAliases: ['Eiffel Tower', 'Louvre', 'France'] },
  { id: 'rome', name: 'Rome', region: 'Italy', emoji: '🏛️', climate: 'mediterranean',
    about: 'Ancient sites are best explored in the mild shoulder seasons. Summer is scorching and swarmed with queues; many locals (and some restaurants) leave in August.',
    base: { sunbathing:2, swimming:1, diving:1, surfing:1, sailing:2, hiking:3, scenic:5, fishing:1, roadtrip:4, adventure:2, golf:2, stargazing:2, museums:10, architecture:10, festivals:6, finedining:9, streetfood:8, nightlife:7, winetasting:7, spa:4, snowsports:0, cycling:4, shopping:7, birding:2, wildlife:1 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [4,5,9,10,11], wet: [11,12,1], hot: [6,7,8], cold: [1], peak: [6,7,8], peakIntensity: 'extreme', low: [1,2], naSliders: ['swimming', 'surfing', 'diving'],
    monthlyWeather: [
      "cold and rainy, one of the coldest, wettest months",
      "cold and still rainy, though days are slowly brightening",
      "mild and fresh, with spring arriving and crowds still light",
      "mild and increasingly sunny, one of the best months for sightseeing",
      "warm and pleasant, before the summer heat and crowds arrive",
      "hot and sunny, with tourist crowds building quickly",
      "hot, dry, and crowded, with long queues at major sites",
      "the hottest month, scorching with many locals and some restaurants leaving the city",
      "warm and sunny, with crowds and heat both starting to ease",
      "mild and pleasant, one of the best months as rain returns gradually",
      "cool and rainy, the wettest month of the year",
      "cool and mild, with a festive atmosphere and lighter crowds"
    ], searchAliases: ['Vatican', 'Colosseum', 'Italy'] },
  { id: 'london', name: 'London', region: 'United Kingdom', emoji: '🎡', climate: 'temperate',
    about: 'Museums and culture run year-round; summer has the best weather odds and biggest crowds, winter is grey but has Christmas markets and thinner queues.',
    base: { sunbathing:1, swimming:1, diving:1, surfing:1, sailing:2, hiking:2, scenic:4, fishing:2, roadtrip:4, adventure:2, golf:4, stargazing:1, museums:10, architecture:9, festivals:7, finedining:9, streetfood:7, nightlife:8, winetasting:4, spa:5, snowsports:0, cycling:5, shopping:8, birding:3, wildlife:2 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [5,6,7,8], wet: [11,12,1,2], peak: [6,7,8,12], low: [1,2,11], specialSeasons: [{ months: [12], text: "Christmas markets and festive lights fill the city, from Hyde Park's Winter Wonderland to the Southbank." }], naSliders: ['snowsports', 'swimming', 'surfing', 'diving'],
    monthlyWeather: [
      "cold and often grey, the coldest month with short days",
      "cold and grey, still one of the quieter months",
      "cool and increasingly bright, with spring arriving unevenly",
      "mild and changeable, sun and showers can both arrive within a day",
      "mild and increasingly pleasant, one of the best months for sightseeing",
      "warm and sunny, with the longest days of the year",
      "warm and mostly sunny, the peak of summer crowds",
      "warm and humid at times, still busy with summer visitors",
      "mild and pleasant, one of the best months as crowds thin",
      "cool and rainy, the wettest month of the year",
      "cold and grey, with rain frequent and days growing short",
      "cold and grey, with festive lights and Christmas markets brightening the gloom"
    ], searchAliases: ['Big Ben', 'United Kingdom', 'England'] },
  { id: 'nyc', name: 'New York City', region: 'USA', emoji: '🗽', climate: 'temperate',
    about: 'Fall (Sep–Nov) is widely considered ideal — crisp air, foliage in nearby parks. Summer is hot/humid, winter brings holiday magic but bitter cold.',
    base: { sunbathing:2, swimming:1, diving:1, surfing:3, sailing:3, hiking:2, scenic:4, fishing:2, roadtrip:4, adventure:2, golf:3, stargazing:1, museums:10, architecture:9, festivals:7, finedining:10, streetfood:9, nightlife:9, winetasting:4, spa:5, snowsports:2, cycling:5, shopping:9, birding:4, wildlife:2 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['lively','highenergy'], physicalBands: ['easy','moderate'],
    dry: [4,5,9,10], hot: [7,8], cold: [12,1,2], peak: [12,9,10], low: [1,2], naSliders: ['swimming', 'diving'],
    monthlyWeather: [
      "bitterly cold, with occasional snow and biting wind off the rivers",
      "cold and still snowy, one of the coldest months",
      "cold and blustery, with winter slow to loosen its grip",
      "mild and increasingly pleasant, with spring finally taking hold",
      "mild and one of the best months, comfortable for walking the city",
      "warm and increasingly humid, with summer building fast",
      "hot and humid, with the summer heat in full swing",
      "hot and humid, still deep in summer's muggiest stretch",
      "warm and comfortable, one of the best months as humidity eases",
      "mild and crisp, with fall foliage in nearby parks",
      "cold and increasingly grey, with winter approaching fast",
      "cold, with holiday lights and occasional snow bringing festive energy"
    ], searchAliases: ['New York', 'Manhattan', 'Brooklyn'] },
  { id: 'barcelona', name: 'Barcelona', region: 'Spain', emoji: '⛲', climate: 'mediterranean',
    about: 'Beach and city combined; late spring and early fall are ideal. August is hot, crowded, and many locals are away.',
    base: { sunbathing:7, swimming:7, diving:4, surfing:4, sailing:6, hiking:4, scenic:6, fishing:2, roadtrip:5, adventure:3, golf:4, stargazing:2, museums:9, architecture:10, festivals:7, finedining:9, streetfood:8, nightlife:9, winetasting:6, spa:5, snowsports:0, cycling:6, shopping:7, birding:3, wildlife:1 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'strong', gravelRiding: 'casual', mountainBiking: 'casual' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively','highenergy'], physicalBands: ['easy','moderate'],
    dry: [5,6,9,10], wet: [11,12,1], hot: [7,8], peak: [7,8], peakIntensity: 'extreme', low: [1,2], naSliders: ['snowsports'],
    monthlyWeather: [
      "mild and occasionally rainy, the coolest month but still gentle by European standards",
      "mild and drying out, with sunny stretches becoming more common",
      "mild and increasingly pleasant, with spring warmth building",
      "warm and mostly dry, one of the best months for the city and beach alike",
      "warm and sunny, still comfortable before the summer crowds arrive",
      "hot and sunny, with the beach season kicking into gear",
      "hot, dry, and increasingly crowded, the driest month of the year",
      "hot and humid, with many locals away and the city at its most touristy",
      "warm and pleasant, one of the best months as the heat and crowds ease",
      "mild and still comfortable, with rain becoming more frequent",
      "mild and rainy, with the wet season settling in",
      "mild, with the coolest temperatures of the year but still gentle"
    ], searchAliases: ['Sagrada Familia', 'Spain', 'Catalonia'] },
  { id: 'amsterdam', name: 'Amsterdam', region: 'Netherlands', emoji: '🚲', climate: 'temperate',
    about: 'Compact, bike-friendly city; tulip season (April) and summer are magical but busy, winter is grey, wet and quiet.',
    base: { sunbathing:1, swimming:1, diving:1, surfing:1, sailing:4, hiking:2, scenic:4, fishing:2, roadtrip:3, adventure:2, golf:2, stargazing:1, museums:9, architecture:8, festivals:7, finedining:7, streetfood:6, nightlife:8, winetasting:3, spa:4, snowsports:0, cycling:9, shopping:7, birding:3, wildlife:1 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [4,5,6,7,8], wet: [11,12,1,2], peak: [4,6,7,8], low: [11,1,2], specialSeasons: [{ months: [4], text: "Tulip season is in full bloom across the countryside and at Keukenhof gardens." }], naSliders: ['snowsports', 'swimming', 'surfing', 'diving'],
    monthlyWeather: [
      "cold and damp, with grey skies and occasional light snow",
      "cold and damp, still one of the quieter months",
      "cool and breezy, with spring slow to take hold",
      "mild and increasingly colorful, as tulip season peaks",
      "mild and pleasant, one of the best months for cycling the city",
      "warm and increasingly sunny, with long, pleasant days",
      "warm, with occasional heatwaves pushing temperatures higher",
      "warm and humid, the wettest summer month with sudden thunderstorms",
      "mild and comfortable, one of the better months as crowds thin",
      "cool and rainy, with autumn setting in",
      "cold and grey, with rain frequent and days growing short",
      "cold and damp, with festive lights against grey winter skies"
    ], searchAliases: ['Netherlands', 'Holland'] },
);
RAW_DESTINATIONS.push(
  { id: 'prague', name: 'Prague', region: 'Czechia', emoji: '🏰', climate: 'temperate',
    about: 'Fairy-tale architecture year-round; spring and fall are mild and quieter, December brings famous Christmas markets, summer is warm and busiest.',
    base: { sunbathing:1, swimming:1, diving:1, surfing:1, sailing:1, hiking:3, scenic:5, fishing:2, roadtrip:4, adventure:2, golf:2, stargazing:1, museums:9, architecture:10, festivals:6, finedining:7, streetfood:6, nightlife:7, winetasting:4, spa:5, snowsports:1, cycling:4, shopping:6, birding:2, wildlife:1 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [5,6,9], hot: [], cold: [12,1,2], peak: [6,7,8,12], low: [1,2], specialSeasons: [{ months: [12], text: "Christmas markets fill the Old Town Square with mulled wine, crafts and festive lights." }], naSliders: ['swimming', 'surfing', 'diving', 'sailing'],
    monthlyWeather: [
      "cold, often below freezing, with snow common across the city",
      "cold and dry-ish, still firmly in winter's grip",
      "cool and unpredictable, with spring arriving unevenly",
      "mild, though April showers can arrive with little warning",
      "mild and increasingly pleasant, one of the best months for the fairy-tale streets",
      "warm and pleasant, with long days and occasional rain",
      "warm, with the year's wettest stretch bringing frequent showers",
      "warm and humid at times, still one of the busiest months",
      "mild and pleasant, one of the best months as crowds thin",
      "cool and increasingly grey, with rain becoming more frequent",
      "cold and damp, with winter settling back in",
      "cold, with snow-dusted spires and the famous Christmas markets in full swing"
    ], searchAliases: ['Czech Republic', 'Czechia'] },
  { id: 'vienna', name: 'Vienna', region: 'Austria', emoji: '🎻', climate: 'temperate',
    about: 'Imperial palaces and classical music year-round; spring/fall for mild sightseeing weather, December for the famous Christmas markets.',
    base: { sunbathing:1, swimming:1, diving:1, surfing:1, sailing:1, hiking:3, scenic:4, fishing:1, roadtrip:4, adventure:2, golf:2, stargazing:1, museums:9, architecture:9, festivals:7, finedining:7, streetfood:5, nightlife:5, winetasting:6, spa:5, snowsports:1, cycling:4, shopping:6, birding:3, wildlife:1 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['easygoing'], physicalBands: ['easy','moderate'],
    dry: [5,6,9], cold: [12,1,2], peak: [6,7,12], low: [1,2], specialSeasons: [{ months: [12], text: "Christmas markets fill the squares around the imperial palaces, a Viennese tradition." }], naSliders: ['swimming', 'surfing', 'diving', 'sailing'],
    monthlyWeather: [
      "cold, often below freezing at night, with grey skies common",
      "cold, still firmly in winter with occasional snow",
      "cool and unpredictable, with spring slow to take hold",
      "mild but changeable, with warmth building unevenly through the month",
      "mild and increasingly pleasant, one of the best months for the palaces and parks",
      "warm and pleasant, with long, comfortable days",
      "hot, the warmest month with occasional thunderstorms",
      "warm and still summery, though slightly less intense than July",
      "mild and pleasant, one of the best months as the city eases into fall",
      "cool and comfortable, with autumn color settling in",
      "cold and grey, with the sunniest hours of the year at their scarcest",
      "cold, with snow-dusted imperial architecture and famous Christmas markets"
    ], searchAliases: ['Austria'] },
  { id: 'berlin', name: 'Berlin', region: 'Germany', emoji: '🐻', climate: 'temperate',
    about: 'History, art and nightlife; summer brings long days and outdoor culture, winter is cold and dark but atmospheric with Christmas markets.',
    base: { sunbathing:2, swimming:2, diving:1, surfing:1, sailing:2, hiking:3, scenic:4, fishing:2, roadtrip:4, adventure:2, golf:2, stargazing:1, museums:9, architecture:8, festivals:7, finedining:7, streetfood:7, nightlife:10, winetasting:3, spa:4, snowsports:0, cycling:6, shopping:6, birding:3, wildlife:2 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['lively','highenergy'], physicalBands: ['easy','moderate'],
    dry: [5,6,7,8], cold: [12,1,2], peak: [6,7,8], low: [1,2], specialSeasons: [{ months: [12], text: "Christmas markets fill squares across the city with mulled wine and crafts." }], naSliders: ['surfing', 'diving'],
    monthlyWeather: [
      "cold, often below freezing, with the year's heaviest snowfall",
      "cold and still deep in winter, with grey skies common",
      "cool, with winter still lingering into the first half of the month",
      "mild but changeable, with spring warmth building unevenly",
      "mild and increasingly pleasant, one of the best months for outdoor culture",
      "warm and sunny, with long days and outdoor life in full swing",
      "warm, the sunniest month with occasional summer storms",
      "warm and still summery, though can bring sudden heat",
      "mild and pleasant, one of the best months as the city settles into fall",
      "cool and increasingly grey, with rain becoming more regular",
      "cold and damp, with short days setting in",
      "cold, with festive Christmas markets against dark winter skies"
    ], searchAliases: ['Germany'] },
  { id: 'istanbul', name: 'Istanbul', region: 'Turkey', emoji: '🕌', climate: 'mediterranean',
    about: 'Where Europe meets Asia; spring and fall have the most comfortable weather, summer is hot and packed, winter is cool and quiet.',
    base: { sunbathing:3, swimming:3, diving:2, surfing:1, sailing:4, hiking:2, scenic:5, fishing:2, roadtrip:4, adventure:2, golf:1, stargazing:2, museums:10, architecture:10, festivals:6, finedining:9, streetfood:10, nightlife:7, winetasting:3, spa:8, snowsports:0, cycling:2, shopping:8, birding:4, wildlife:2 },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [4,5,9,10], hot: [7,8], cold: [2], peak: [6,7,8], low: [12,1,2], naSliders: ['surfing'],
    monthlyWeather: [
      "cool and rainy, with occasional light snow",
      "cool and still one of the coldest, wettest months",
      "mild and increasingly pleasant, with spring warmth building",
      "mild and comfortable, one of the best months before the summer crowds",
      "warm and mostly dry, still comfortable and increasingly popular",
      "hot and dry, with summer crowds building fast",
      "hot and dry, one of the driest and busiest months",
      "hot and dry, still deep in the summer crowds and heat",
      "warm and increasingly pleasant, one of the best months as crowds ease",
      "mild, with rain becoming more frequent as autumn sets in",
      "cool and rainy, with the wet season firmly established",
      "cool and rainy, the wettest month of the year"
    ], searchAliases: ['Turkey', 'Hagia Sophia', 'Bosphorus'] },
  { id: 'dubai', name: 'Dubai', region: 'UAE', emoji: '🏙️', climate: 'desert',
    about: 'Ultramodern desert city; Nov–Mar is warm and pleasant, summer (Jun–Aug) is extremely hot and humid — best avoided for outdoor time.',
    base: { sunbathing:7, swimming:7, diving:5, surfing:2, sailing:6, hiking:2, scenic:4, fishing:3, roadtrip:5, adventure:5, golf:9, stargazing:3, museums:4, architecture:10, festivals:4, finedining:9, streetfood:6, nightlife:8, winetasting:2, spa:8, snowsports:2, cycling:2, shopping:10, birding:4, wildlife:1 },
    activityStyleTiers: { scenic: { deserts: 'strong', coastlines: 'casual', mountains: 'none', forests: 'none', astrophotography: 'casual' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['lively','highenergy'], physicalBands: ['easy','moderate'],
    dry: [11,12,1,2,3], hot: [6,7,8], peak: [12,1,2], low: [7,8], naSliders: ['snowsports'],
    monthlyWeather: [
      "warm and pleasant, the most comfortable month of the year",
      "still mild and sunny, ideal for being outside",
      "warming up, though evenings stay comfortable",
      "hot by day, with summer heat starting to build",
      "very hot, with daytime highs regularly near 40°C",
      "scorching and dry, with highs often above 40°C",
      "extreme heat combined with high humidity that makes it feel even hotter",
      "the hottest month, often exceeding 41°C with oppressive humidity",
      "still brutally hot and humid, though marginally easing by month's end",
      "cooling gradually, though afternoons remain hot",
      "increasingly comfortable, with pleasant evenings returning",
      "mild and sunny, back to one of the most pleasant times to visit"
    ], searchAliases: ['UAE', 'United Arab Emirates', 'Burj Khalifa'] },
  { id: 'singapore', name: 'Singapore', region: 'Southeast Asia', emoji: '🦁', climate: 'tropical',
    about: 'Hot and humid year-round with no real weather off-season; Feb–Apr is driest, Nov–Jan brings the heaviest monsoon rain.',
    base: { sunbathing:3, swimming:3, diving:3, surfing:1, sailing:4, hiking:3, scenic:4, fishing:2, roadtrip:2, adventure:3, golf:6, stargazing:1, museums:7, architecture:8, festivals:7, finedining:9, streetfood:10, nightlife:8, winetasting:3, spa:6, snowsports:0, cycling:4, shopping:9, birding:6, wildlife:4 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [2,3,4], wet: [11,12,1], peak: [12,6,7], low: [9,10], naSliders: ['snowsports', 'surfing'],
    monthlyWeather: [
      "hot and humid, with occasional showers lingering from the wetter months",
      "the year's driest stretch, still warm and humid but with the clearest skies",
      "warm and humid, with showers becoming more frequent again",
      "the hottest daytime temperatures of the year, humid and still",
      "steamy and humid, with the warmest nights of the year",
      "humid with sudden, heavy afternoon thunderstorms as the monsoon shifts",
      "consistently hot and humid, with thunderstorms a near-daily occurrence",
      "hot, humid, and thundery, much like the month before",
      "still humid and thundery, though storms start easing slightly",
      "humid with rain building again as the wetter half of the year approaches",
      "the wettest month, humid with frequent, heavy downpours",
      "humid and rainy, among the wettest and coolest-feeling months of the year"
    ], searchAliases: ['Marina Bay'] },
  { id: 'hongkong', name: 'Hong Kong', region: 'China', emoji: '🌃', climate: 'temperate',
    about: 'Skyline and street-food icon; Oct–Dec is comfortable and clear, summer is hot, humid and typhoon-prone, winter is mild and dry.',
    base: { sunbathing:3, swimming:4, diving:3, surfing:2, sailing:5, hiking:5, scenic:6, fishing:3, roadtrip:3, adventure:3, golf:4, stargazing:2, museums:7, architecture:8, festivals:7, finedining:9, streetfood:10, nightlife:9, winetasting:3, spa:6, snowsports:0, cycling:3, shopping:10, birding:6, wildlife:3 },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['lively','highenergy'], physicalBands: ['easy','moderate','active'],
    dry: [10,11,12], wet: [5,6,7,8,9], hot: [6,7,8], peak: [10,11,12], low: [2,3], swimHazard: [7,8,9], naSliders: ['snowsports'],
    monthlyWeather: [
      "cool and dry, one of the most comfortable months",
      "cool and increasingly humid, with mist common in the harbor",
      "mild and humid, with visibility often reduced by haze",
      "warm and humid, with rain becoming more frequent",
      "hot and humid, as the wet season builds",
      "hot and humid, with regular downpours and rising typhoon risk",
      "hot and humid, deep in typhoon season with sudden storms possible",
      "hot and humid, still within typhoon season with heavy rain likely",
      "hot and humid, one of the most typhoon-prone months",
      "warm and drying out, one of the most pleasant months with clearer skies",
      "mild and dry, comfortable with lower humidity",
      "cool and dry, one of the most comfortable months of the year"
    ], searchAliases: ['China', 'Victoria Harbour'] },
  { id: 'bangkok', name: 'Bangkok', region: 'Thailand', emoji: '🍜', climate: 'tropical',
    about: 'Cool season (Nov–Feb) is the pleasant window; hot season (Mar–May) is brutal, monsoon (Jun–Oct) brings frequent downpours.',
    base: { sunbathing:2, swimming:1, diving:1, surfing:1, sailing:2, hiking:1, scenic:3, fishing:1, roadtrip:3, adventure:2, golf:5, stargazing:1, museums:8, architecture:9, festivals:4, finedining:8, streetfood:10, nightlife:10, winetasting:1, spa:8, snowsports:0, cycling:2, shopping:10, birding:4, wildlife:2 },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['lively','highenergy'], physicalBands: ['easy','moderate'],
    dry: [11,12,1,2], hot: [3,4,5], wet: [6,7,8,9,10], peak: [11,12,1], low: [6,7,8,9], sliderEvents: { festivals: [
      { label: 'Songkran (water festival)', weight: 5, months: { 4: 1 } },
    ] }, naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'winetasting'],
    monthlyWeather: [
      "warm and dry, one of the most comfortable months of the year",
      "warm and dry, still pleasant before the heat builds",
      "hot and dry, with the heat intensifying fast",
      "scorching, the hottest month with temperatures regularly above 35°C",
      "hot and increasingly humid, as the rains begin",
      "hot and rainy, with regular but often brief afternoon downpours",
      "hot and rainy, still early in the monsoon",
      "hot and rainy, with showers a near-daily occurrence",
      "hot and rainy, one of the wettest months of the year",
      "hot and rainy, still within the wettest stretch of the year",
      "warm and drying out, as the cool season begins",
      "warm and dry, one of the most pleasant months of the year"
    ], searchAliases: ['Thailand'] },
  { id: 'seoul', name: 'Seoul', region: 'South Korea', emoji: '🇰🇷', climate: 'temperate',
    about: 'Four distinct seasons; spring cherry blossoms and fall foliage are the highlights, summer is hot/humid with monsoon rain, winter is cold and dry.',
    base: { sunbathing:1, swimming:1, diving:1, surfing:1, sailing:1, hiking:5, scenic:6, fishing:2, roadtrip:4, adventure:3, golf:5, stargazing:1, museums:8, architecture:8, festivals:7, finedining:9, streetfood:9, nightlife:9, winetasting:2, spa:8, snowsports:4, cycling:4, shopping:9, birding:4, wildlife:2 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['lively','highenergy'], physicalBands: ['easy','moderate','active'],
    dry: [4,5,9,10], wet: [6,7,8], cold: [12,1,2], peak: [4,10], low: [1,2], specialSeasons: [{ months: [4], text: "Cherry blossoms bloom around the city, especially along the Han River and old palaces." }, { months: [10], text: "Fall foliage peaks in the mountains and palace gardens around the city." }], naSliders: ['swimming', 'surfing', 'diving', 'sailing'],
    monthlyWeather: [
      "cold and dry, the coldest month with crisp, clear skies",
      "cold and dry, still deep in winter though days are lengthening",
      "cool and increasingly bright, with early cherry blossoms in the south",
      "mild and colorful, with cherry blossoms peaking across the city",
      "mild and pleasant, one of the best months before the humidity builds",
      "warm and increasingly humid, with the monsoon arriving by month's end",
      "hot and humid, deep in the monsoon with heavy, sudden downpours",
      "hot and humid, still sweltering with high humidity lingering",
      "warm and drying out, one of the best months as humidity eases",
      "mild and crisp, with fall foliage at its peak",
      "cool and dry, with foliage fading and winter approaching",
      "cold and dry, with clear skies and winter settling in"
    ], searchAliases: ['South Korea', 'Korea'] },
  { id: 'sydney', name: 'Sydney', region: 'Australia', emoji: '🏄', climate: 'mediterranean',
    about: 'Southern Hemisphere summer (Dec–Feb) is beach season and peak crowds/prices; autumn (Mar–May) offers warm days with far fewer people.',
    base: { sunbathing:8, swimming:8, diving:5, surfing:8, sailing:8, hiking:5, scenic:7, fishing:5, roadtrip:6, adventure:5, golf:5, stargazing:3, museums:6, architecture:7, festivals:5, finedining:8, streetfood:6, nightlife:8, winetasting:6, spa:5, snowsports:0, cycling:5, shopping:7, birding:4, wildlife:4 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate','active'],
    dry: [12,1,2,3], cold: [7], peak: [12,1,2], low: [6,7],
    monthlyWeather: [
      "hot and sunny, the peak of summer with beaches at their busiest",
      "hot and humid, still deep in summer with occasional storms",
      "warm and sunny, with summer easing into a pleasant autumn",
      "mild and dry, one of the best months with thinning crowds",
      "mild and increasingly cool, comfortable with fewer visitors",
      "cool, the start of a mild winter with crisp, sunny days common",
      "cool, the coldest month though still mild by most standards",
      "cool and dry, still comfortable with clear skies",
      "mild and dry, with spring warming things up",
      "mild and pleasant, one of the best months with low humidity",
      "warm and increasingly sunny, as summer builds",
      "hot and sunny, with summer in full swing and the sunniest stretch of the year"
    ], searchAliases: ['Opera House', 'Australia', 'Bondi'] },
  { id: 'rio', name: 'Rio de Janeiro', region: 'Brazil', emoji: '🏖️', climate: 'tropical',
    about: 'Beaches and Carnival energy; Dec–Mar is hot, festive and peak (Carnival usually falls in Feb), Jun–Aug is cooler, drier and much quieter.',
    base: { sunbathing:9, swimming:8, diving:4, surfing:7, sailing:6, hiking:6, scenic:6, fishing:3, roadtrip:4, adventure:6, golf:3, stargazing:3, museums:6, architecture:7, festivals:4, finedining:7, streetfood:7, nightlife:9, winetasting:3, spa:5, snowsports:0, cycling:5, shopping:5, birding:4, wildlife:4 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' }, scenic: { mountains: 'strong', coastlines: 'strong', forests: 'none', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['lively','highenergy'], physicalBands: ['easy','moderate','active'],
    dry: [6,7,8,9], wet: [12,1,2,3], peak: [12,1,2], low: [6,7], sliderEvents: { scenic: [
      { label: 'Dry-season clarity', weight: 3, months: { 6: 0.7, 7: 1, 8: 1, 9: 0.7 } },
    ], festivals: [
      { label: 'Carnival', weight: 6, months: { 2: 1, 3: 0.3 } },
    ] }, specialSeasons: [{ months: [2], text: "Carnival typically falls this month, filling the city with parades, street parties and huge crowds." }], naSliders: ['snowsports'],
    monthlyWeather: [
      "hot, humid, and rainy, with Carnival energy building",
      "hot and humid, the peak of Carnival season with frequent showers",
      "hot and humid, still within the wet season with regular rain",
      "warm and increasingly dry, as the rains begin easing",
      "warm and drying out, one of the more comfortable months",
      "mild and dry, with cooler, more comfortable temperatures",
      "mild and dry, the coolest month of the year",
      "mild and dry, still comfortable with the driest conditions",
      "warm and dry, with temperatures beginning to climb again",
      "warm and increasingly humid, as the wet season approaches",
      "hot and increasingly wet, with rain becoming more frequent",
      "hot, humid, and rainy, as the wet season builds toward Carnival"
    ], searchAliases: ['Copacabana', 'Ipanema', 'Christ the Redeemer', 'Brazil'] },
  { id: 'buenosaires', name: 'Buenos Aires', region: 'Argentina', emoji: '💃', climate: 'temperate',
    about: 'European-flavored city with Southern Hemisphere seasons; spring (Sep–Nov) and fall (Mar–May) are mild and ideal, summer is hot and humid.',
    base: { sunbathing:2, swimming:1, diving:1, surfing:1, sailing:2, hiking:2, scenic:3, fishing:2, roadtrip:4, adventure:2, golf:3, stargazing:1, museums:8, architecture:9, festivals:6, finedining:9, streetfood:7, nightlife:9, winetasting:7, spa:4, snowsports:0, cycling:4, shopping:7, birding:4, wildlife:2 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['lively','highenergy'], physicalBands: ['easy','moderate'],
    dry: [9,10,11,3,4,5], hot: [12,1,2], cold: [7], peak: [12,1], low: [6,7], naSliders: ['swimming', 'surfing', 'diving'],
    monthlyWeather: [
      "hot and humid, the peak of summer with intense afternoon heat",
      "hot and humid, still deep in summer with occasional storms",
      "warm and pleasant, with summer easing into a comfortable fall",
      "mild and comfortable, one of the best months of the year",
      "mild and cooling, still pleasant with autumn colors",
      "cool, with the year's cloudiest, greyest stretch beginning",
      "cool, the coldest month though rarely severe",
      "cool and still cloudy, with winter beginning to loosen its grip",
      "mild and pleasant, as spring begins to warm things up",
      "mild and increasingly wet, the wettest month of the year",
      "warm and pleasant, one of the best months before summer heat arrives",
      "hot and humid, with summer heat building fast"
    ], searchAliases: ['Argentina'] },
  { id: 'venice', name: 'Venice', region: 'Italy', emoji: '🚤', climate: 'mediterranean',
    about: 'Canals and Carnival; spring and fall are ideal, summer is hot, crowded and can smell in the canals, acqua alta flooding is more common Oct–Jan.',
    base: { sunbathing:2, swimming:2, diving:2, surfing:1, sailing:8, hiking:1, scenic:7, fishing:2, roadtrip:3, adventure:1, golf:1, stargazing:1, museums:9, architecture:10, festivals:4, finedining:8, streetfood:6, nightlife:5, winetasting:6, spa:4, snowsports:0, cycling:2, shopping:7, birding:2, wildlife:1 },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['easygoing'], physicalBands: ['easy'],
    dry: [4,5,9,10], wet: [11,12,1], hot: [7,8], peak: [6,7,8], peakIntensity: 'extreme', low: [1,2], sliderEvents: { festivals: [
      { label: 'Carnival', weight: 4, months: { 2: 1 } },
    ] }, specialSeasons: [{ months: [2], text: "Carnival season brings elaborate masks and costumed crowds to the city." }, { months: [11,12,1], text: "Acqua alta flooding in St. Mark's Square is more common this time of year." }], naSliders: ['snowsports', 'surfing'],
    monthlyWeather: [
      "cold and damp, with the acqua alta season and occasional flooding",
      "cold and damp, still within acqua alta season though easing",
      "mild and increasingly pleasant, with spring warmth building",
      "mild and comfortable, one of the best months before the crowds",
      "warm and pleasant, still comfortable before peak summer heat",
      "warm and increasingly humid, with the canals starting to smell in the heat",
      "hot and humid, crowded with the canal smell at its strongest",
      "hot and humid, still crowded and muggy in the narrow streets",
      "warm and pleasant, one of the best months as crowds and heat ease",
      "mild, with acqua alta flooding becoming more frequent",
      "cool and damp, the peak month for acqua alta flooding",
      "cold and damp, with acqua alta risk continuing through the season"
    ], searchAliases: ['Italy', 'canals'] },
);
RAW_DESTINATIONS.push(
  { id: 'lisbon', name: 'Lisbon', region: 'Portugal', emoji: '🚋', climate: 'mediterranean',
    about: 'Sunny hillside capital; summer is warm/dry and busy, spring and fall are mild and quieter, winter is mild but wetter.',
    base: { sunbathing:6, swimming:5, diving:4, surfing:7, sailing:6, hiking:3, scenic:6, fishing:4, roadtrip:5, adventure:3, golf:6, stargazing:2, museums:8, architecture:8, festivals:6, finedining:9, streetfood:7, nightlife:8, winetasting:6, spa:5, snowsports:0, cycling:4, shopping:6, birding:4, wildlife:2 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [6,7,8,9], wet: [11,12,1,2], peak: [7,8], low: [12,1,2], naSliders: ['snowsports'],
    monthlyWeather: [
      "mild but wet, with Atlantic storms bringing the year's heaviest rain",
      "mild and still fairly wet, though sunnier spells become more common",
      "mild and drying out, with spring warmth building",
      "mild and increasingly sunny, with the last of the rain easing by mid-month",
      "warm and mostly dry, one of the best months of the year",
      "warm and sunny, with long, pleasant days",
      "warm, dry, and sunny, one of the driest months of the year",
      "warm and dry, still sunny with reliably clear skies",
      "warm and sunny, still pleasant as summer eases",
      "mild, with rain returning gradually as autumn sets in",
      "mild and wet, the wettest month of the year",
      "mild but wet, with Atlantic storms rolling through regularly"
    ], searchAliases: ['Portugal', 'Sintra'] },
  { id: 'budapest', name: 'Budapest', region: 'Hungary', emoji: '♨️', climate: 'temperate',
    about: 'Thermal baths and grand architecture; spring/fall are mild and quiet, summer is warm and busiest, winter is cold with festive Christmas markets.',
    base: { sunbathing:2, swimming:2, diving:1, surfing:1, sailing:2, hiking:2, scenic:4, fishing:2, roadtrip:4, adventure:2, golf:2, stargazing:1, museums:8, architecture:9, festivals:6, finedining:7, streetfood:6, nightlife:8, winetasting:5, spa:9, snowsports:1, cycling:4, shopping:6, birding:3, wildlife:1 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [5,6,9], cold: [12,1,2], peak: [6,7,8], low: [1,2], specialSeasons: [{ months: [12], text: "Christmas markets fill Vörösmarty Square with mulled wine, crafts and festive lights." }], naSliders: ['surfing', 'diving'],
    monthlyWeather: [
      "cold, often below freezing, with grey skies and occasional snow",
      "cold, still firmly in winter with limited sunshine",
      "cool and unpredictable, with spring slow to take hold",
      "mild but changeable, with warmth building unevenly",
      "mild and increasingly pleasant, one of the best months for sightseeing",
      "warm and pleasant, with the year's wettest stretch bringing regular showers",
      "hot, the warmest month with occasional thunderstorms",
      "hot and still summery, though slightly less intense than July",
      "mild and pleasant, one of the best months as the city eases into fall",
      "cool and comfortable, with autumn color settling in",
      "cold and grey, with sunshine scarce",
      "cold, with festive Christmas markets against dark winter skies"
    ], searchAliases: ['Hungary'] },
  { id: 'edinburgh', name: 'Edinburgh', region: 'Scotland', emoji: '🏴', climate: 'temperate',
    about: 'Historic and atmospheric; August brings the world-famous Fringe Festival (also the busiest, priciest month), winter is dark, cold and quiet.',
    base: { sunbathing:1, swimming:1, diving:1, surfing:1, sailing:2, hiking:5, scenic:6, fishing:3, roadtrip:5, adventure:3, golf:6, stargazing:2, museums:8, architecture:9, festivals:4, finedining:7, streetfood:5, nightlife:7, winetasting:4, spa:4, snowsports:1, cycling:4, shopping:6, birding:4, wildlife:3 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate','active'],
    dry: [5,6,7,8], wet: [11,12,1,2], peak: [8,12], peakIntensity: 'extreme', low: [1,2,11], sliderEvents: { festivals: [
      { label: 'Fringe Festival', weight: 6, months: { 8: 1 } },
    ] }, specialSeasons: [{ months: [8], text: "The Fringe Festival transforms the city with thousands of shows — also the busiest, priciest time to visit." }], naSliders: ['snowsports', 'swimming', 'surfing', 'diving'],
    monthlyWeather: [
      "cold and damp, with short days and frequent rain",
      "cold and still damp, one of the year's coldest stretches",
      "cool and breezy, with spring slow to take hold",
      "mild but changeable, with brighter days becoming more common",
      "mild and increasingly pleasant, one of the best months with the most sunshine",
      "mild and comfortable, with long daylight hours",
      "mild, the warmest month though rarely hot",
      "mild, with the Fringe Festival filling the city and crowds at their peak",
      "cool and pleasant, with festival crowds gone and comfortable weather lingering",
      "cool and increasingly grey, the wettest month of the year",
      "cold and damp, with short days setting in fast",
      "cold, dark, and often wet, with festive lights against the winter gloom"
    ], searchAliases: ['Scotland', 'United Kingdom', 'Fringe Festival'] },
  { id: 'copenhagen', name: 'Copenhagen', region: 'Denmark', emoji: '🚴', climate: 'temperate',
    about: 'Design-forward Nordic capital; summer brings long light-filled days, winter is dark and cold but cozy and much less crowded.',
    base: { sunbathing:3, swimming:3, diving:1, surfing:2, sailing:5, hiking:3, scenic:5, fishing:3, roadtrip:4, adventure:2, golf:3, stargazing:1, museums:7, architecture:8, festivals:6, finedining:8, streetfood:6, nightlife:7, winetasting:3, spa:5, snowsports:0, cycling:9, shopping:7, birding:3, wildlife:2 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [5,6,7,8], cold: [12,1,2], peak: [6,7], low: [1,2], naSliders: ['diving'],
    monthlyWeather: [
      "cold, often damp, with short days and the darkest stretch of the year",
      "cold and grey, still firmly in winter",
      "cool and breezy, with spring slow to take hold",
      "mild but changeable, with brighter days becoming common",
      "mild and increasingly pleasant, one of the sunniest and best months",
      "warm and sunny, with long, light-filled days",
      "warm, the warmest month with pleasant, mild heat",
      "warm and still pleasant, though days begin shortening",
      "mild and crisp, one of the better months as crowds thin",
      "cool and increasingly wet, with autumn setting in",
      "cold and damp, with short days and grey skies",
      "cold and dark, with the year's shortest days offset by cozy holiday lights"
    ], searchAliases: ['Denmark'] },
  { id: 'mexicocity', name: 'Mexico City', region: 'Mexico', emoji: '🌮', climate: 'highland',
    about: 'High-altitude megacity with world-class food and museums; Nov–Apr is dry season, May–Oct brings brief but heavy afternoon showers.',
    base: { sunbathing:2, swimming:1, diving:1, surfing:1, sailing:1, hiking:2, scenic:4, fishing:1, roadtrip:4, adventure:2, golf:3, stargazing:1, museums:9, architecture:9, festivals:4, finedining:10, streetfood:10, nightlife:8, winetasting:3, spa:5, snowsports:0, cycling:4, shopping:7, birding:4, wildlife:2 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['lively','highenergy'], physicalBands: ['easy','moderate'],
    dry: [11,12,1,2,3,4], wet: [6,7,8,9], peak: [12,1], low: [6,7,8,9], sliderEvents: { festivals: [
      { label: 'Día de los Muertos', weight: 5, months: { 11: 1 } },
    ] }, naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'sailing'],
    monthlyWeather: [
      "mild by day but cool at night, dry with clear skies",
      "mild and dry, still comfortable with cool evenings",
      "warming up, dry with strong midday sun at altitude",
      "warm and dry, one of the best months before the rains arrive",
      "warm, with the first afternoon showers of the wet season arriving",
      "mild by day, with regular but usually brief afternoon downpours",
      "mild and rainy, with heavy afternoon showers common",
      "mild and rainy, still deep in the wettest stretch of the year",
      "mild and rainy, with afternoon storms continuing regularly",
      "mild, with rain beginning to ease as the dry season approaches",
      "mild by day but cool at night, dry with clear skies returning",
      "cool, especially at night, dry with crisp, clear conditions"
    ], searchAliases: ['Mexico', 'CDMX'] },
  { id: 'havana', name: 'Havana', region: 'Cuba', emoji: '🚗', climate: 'tropical',
    about: 'Vintage cars and Caribbean rhythm; Nov–Apr is dry and comfortable, hurricane season runs Jun–Nov with risk peaking Aug–Oct.',
    base: { sunbathing:7, swimming:7, diving:5, surfing:2, sailing:5, hiking:2, scenic:5, fishing:4, roadtrip:5, adventure:2, golf:1, stargazing:3, museums:7, architecture:9, festivals:7, finedining:5, streetfood:6, nightlife:8, winetasting:1, spa:3, snowsports:0, cycling:3, shopping:3, birding:4, wildlife:3 },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['lively','highenergy'], physicalBands: ['easy','moderate'],
    dry: [11,12,1,2,3,4], wet: [6,7,8,9], peak: [12,1,2,3], low: [9,10], swimHazard: [8,9,10], naSliders: ['snowsports', 'winetasting'],
    monthlyWeather: [
      "dry and warm, one of the most pleasant months of the year",
      "dry and warm, still comfortable with low humidity",
      "dry and warming, comfortable before the heat builds",
      "warm and mostly dry, one of the best months before the rains return",
      "warm and increasingly humid, as the wet season begins",
      "hot and humid, with the wet season in full swing",
      "hot and humid, with regular afternoon showers",
      "hot and humid, deep in hurricane season with heavy rain possible",
      "hot and humid, the peak of hurricane season with the year's heaviest rain",
      "hot and humid, still within hurricane season with unsettled weather",
      "warm and drying out, with hurricane risk fading",
      "dry and warm, one of the most pleasant months as the dry season returns"
    ], searchAliases: ['Cuba'] },
  { id: 'seychelles', name: 'Seychelles', region: 'Indian Ocean', emoji: '🏝️', climate: 'tropical',
    about: 'Granite-boulder beaches and near year-round warmth; Apr–May and Oct–Nov are calmest between trade winds, Dec–Feb can be rainy and windy.',
    base: { sunbathing:9, swimming:9, diving:9, surfing:3, sailing:7, hiking:3, scenic:7, fishing:6, roadtrip:3, adventure:3, golf:3, stargazing:5, museums:1, architecture:1, festivals:2, finedining:6, streetfood:3, nightlife:2, winetasting:1, spa:8, snowsports:0, cycling:2, shopping:2, birding:6, wildlife:7 },
    activityStyleTiers: { scenic: { coastlines: 'signature', mountains: 'none', forests: 'none', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['highend','luxury'], vibeBands: ['secluded'], physicalBands: ['easy','moderate'],
    dry: [4,5,10,11], wet: [12,1,2], peak: [12,7,8], low: [5,6],
    wildlifePeak: [10,11], birdingPeak: [5,6,9,10], sliderCaps: { wildlife: 8, birding: 8 }, sliderEvents: { scenic: [
      { label: 'Calm-season clarity', weight: 2, months: { 4: 0.7, 5: 0.85, 10: 0.85, 11: 0.7 } },
    ] }, naSliders: ['snowsports', 'museums', 'architecture', 'winetasting'],
    monthlyWeather: [
      "warm and humid, with the year's heaviest rain from the northwest monsoon",
      "warm and rainy, still within the wettest stretch of the year",
      "warm and humid, with rain beginning to ease",
      "warm and calm, one of the best months with light winds",
      "warm, with the trade winds building as the dry season begins",
      "warm and breezy, drier with the southeast trade winds picking up",
      "warm and windy, one of the driest and breeziest months, good for sailing and surfing",
      "warm and windy, still within the breeziest stretch of the year",
      "warm and drying out, with the trade winds beginning to ease",
      "warm and calm, one of the best months with light winds returning",
      "warm and increasingly humid, as the northwest monsoon returns",
      "warm and rainy, with the wet season building toward its peak"
    ], searchAliases: ['Mahe', 'Praslin', 'La Digue'] },
  { id: 'mauritius', name: 'Mauritius', region: 'Indian Ocean', emoji: '🌴', climate: 'tropical',
    about: 'Indian Ocean island resort classic; May–Dec is drier and cooler, cyclone risk runs Jan–Mar.',
    base: { sunbathing:9, swimming:9, diving:8, surfing:4, sailing:7, hiking:4, scenic:7, fishing:5, roadtrip:4, adventure:4, golf:7, stargazing:4, museums:2, architecture:2, festivals:3, finedining:7, streetfood:5, nightlife:4, winetasting:2, spa:8, snowsports:0, cycling:3, shopping:4, birding:5, wildlife:4 },
    activityStyleTiers: { scenic: { coastlines: 'strong', mountains: 'casual', forests: 'none', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate'],
    dry: [5,6,7,8,9,10,11], wet: [1,2,3], peak: [12,1,7,8], low: [2,3], naSliders: ['snowsports'],
    monthlyWeather: [
      "hot and humid, with cyclone risk at its highest",
      "hot and humid, still within the most active cyclone window",
      "hot and rainy, with cyclone risk continuing though easing",
      "warm and increasingly dry, as the rains begin to ease",
      "mild and dry, one of the more comfortable months",
      "mild and dry, with the season's trade winds building",
      "cool and windy, one of the coolest, breeziest months",
      "cool and windy, still within the breeziest stretch of the year",
      "mild and dry, with the trade winds beginning to ease",
      "mild and dry, one of the more pleasant months",
      "warm, with the first summer rains returning",
      "hot and increasingly humid, with the wet season building"
    ], searchAliases: ['Port Louis'] },
  { id: 'fiji', name: 'Fiji', region: 'South Pacific', emoji: '🌊', climate: 'tropical',
    about: 'South Pacific classic; dry season May–Oct is sunny and less humid, wet/cyclone season Nov–Apr is hotter and stormier.',
    base: { sunbathing:9, swimming:9, diving:9, surfing:6, sailing:8, hiking:4, scenic:7, fishing:6, roadtrip:3, adventure:4, golf:3, stargazing:5, museums:1, architecture:1, festivals:3, finedining:5, streetfood:4, nightlife:3, winetasting:1, spa:7, snowsports:0, cycling:2, shopping:3, birding:5, wildlife:5 },
    activityStyleTiers: { scenic: { coastlines: 'strong', mountains: 'none', forests: 'none', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate'],
    dry: [5,6,7,8,9,10], wet: [12,1,2,3], peak: [6,7,8], low: [2,3], swimHazard: [1,2,3], naSliders: ['snowsports', 'museums', 'architecture', 'winetasting'],
    monthlyWeather: [
      "hot and wet, with cyclone risk at its highest",
      "hot and wet, still within the most active cyclone window",
      "hot and rainy, with cyclone risk continuing though easing",
      "warm and increasingly dry, as the wet season winds down",
      "warm and drying out, one of the best months before the dry season settles in",
      "warm and dry, with lower humidity and steady trade winds",
      "mild and dry, one of the driest months of the year",
      "mild and dry, still comfortable with reliable sunshine",
      "warm and dry, still within the driest stretch of the year",
      "warm and dry, the last of the dry season before humidity returns",
      "hot and increasingly humid, as the wet season begins",
      "hot and wet, with rain building toward the cyclone season peak"
    ], searchAliases: ['South Pacific', 'Nadi'] },
  { id: 'borabora', name: 'Bora Bora', region: 'French Polynesia', emoji: '🐬', climate: 'tropical',
    about: 'The overwater-bungalow icon; May–Oct is drier and cooler, Nov–Apr is warmer and wetter with occasional cyclone risk.',
    base: { sunbathing:9, swimming:10, diving:9, surfing:4, sailing:8, hiking:2, scenic:8, fishing:5, roadtrip:1, adventure:3, golf:1, stargazing:5, museums:1, architecture:1, festivals:1, finedining:6, streetfood:2, nightlife:2, winetasting:1, spa:9, snowsports:0, cycling:1, shopping:1, birding:3, wildlife:6 },
    activityStyleTiers: { scenic: { coastlines: 'signature', mountains: 'casual', forests: 'none', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['luxury'], vibeBands: ['secluded'], physicalBands: ['easy'],
    dry: [5,6,7,8,9,10], wet: [12,1,2,3], peak: [6,7,8], peakIntensity: 'mild', low: [11,12], naSliders: ['snowsports', 'museums', 'architecture', 'festivals', 'shopping', 'winetasting'],
    monthlyWeather: [
      "warm and humid, deep in the wet season with regular showers",
      "warm and rainy, still within the wettest stretch of the year",
      "warm and rainy, with showers continuing regularly",
      "warm and increasingly dry, as the wet season winds down",
      "warm and drying out, one of the best months before peak dry season",
      "warm and dry, comfortable with lower humidity",
      "warm and dry, still comfortable with steady conditions",
      "warm, dry, and sunny, the driest month of the year",
      "warm and dry, still within the sunniest, driest stretch",
      "warm and dry, the last of the dry season before humidity builds",
      "warm and increasingly humid, as the wet season begins",
      "warm and rainy, the wettest month of the year"
    ], searchAliases: ['Tahiti', 'French Polynesia'] },
  { id: 'maui', name: 'Maui', region: 'Hawaii, USA', emoji: '🌺', climate: 'tropical',
    about: 'Classic Hawaiian escape; Apr–May and Sep–Oct are the sweet spots — good weather with fewer crowds than the winter and summer peaks.',
    base: { sunbathing:9, swimming:9, diving:7, surfing:8, sailing:6, hiking:7, scenic:9, fishing:6, roadtrip:8, adventure:6, golf:7, stargazing:6, museums:3, architecture:3, festivals:4, finedining:7, streetfood:6, nightlife:5, winetasting:2, spa:7, snowsports:0, cycling:4, shopping:5, birding:5, wildlife:6 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'strong', gravelRiding: 'none', mountainBiking: 'none' }, scenic: { mountains: 'strong', forests: 'strong', coastlines: 'strong', astrophotography: 'strong', deserts: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate','active'],
    dry: [4,5,6,7,8,9], wet: [11,12,1], peak: [12,1,6,7], low: [4,5,9],
    wildlifePeak: [12,1,2,3,4], sliderCaps: { wildlife: 7 }, specialSeasons: [{ months: [12,1,2,3,4], text: "Humpback whales gather in the channel between Maui and Lanai to breed and calve, often visible from shore." }], naSliders: ['snowsports'],
    monthlyWeather: [
      "warm, with the wet season's occasional heavier showers",
      "warm and still within the wetter half of the year",
      "warm and increasingly dry, as showers begin to ease",
      "warm and pleasant, one of the best months before summer crowds",
      "warm and dry, with the dry season settling in",
      "warm and dry, comfortable with steady trade winds",
      "warm and dry, still comfortable through the dry season",
      "warm and dry, still within the sunniest, driest stretch",
      "warm and pleasant, one of the best months with fewer crowds",
      "warm and pleasant, still comfortable before winter's return",
      "warm, with rain becoming more frequent as the wet season begins",
      "warm, with the wet season's occasional heavier showers returning"
    ], searchAliases: ['Hawaii', 'Lahaina', 'Hana'] },
  { id: 'bahamas', name: 'Bahamas', region: 'Caribbean', emoji: '🐚', climate: 'tropical',
    about: 'Turquoise water close to the US East Coast; Dec–Apr is dry season and peak. Hurricane season runs Jun–Nov, risk peaking Aug–Oct.',
    base: { sunbathing:9, swimming:9, diving:8, surfing:3, sailing:8, hiking:1, scenic:5, fishing:7, roadtrip:2, adventure:3, golf:6, stargazing:4, museums:2, architecture:2, festivals:3, finedining:6, streetfood:5, nightlife:5, winetasting:1, spa:6, snowsports:0, cycling:2, shopping:4, birding:4, wildlife:5 },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [12,1,2,3,4], wet: [6,7,8,9,10], peak: [12,1,2,3], low: [9,10], swimHazard: [8,9,10], naSliders: ['snowsports', 'winetasting'],
    monthlyWeather: [
      "dry and warm, one of the most pleasant months of the year",
      "dry and warm, still comfortable with low humidity",
      "dry and warm, still one of the best months to visit",
      "warm and mostly dry, with rain starting to return by month's end",
      "warm and increasingly humid, as the wet season begins",
      "warm and humid, with hurricane season now underway",
      "hot and humid, with regular afternoon showers",
      "hot and humid, with hurricane risk building",
      "hot and humid, the peak of hurricane season",
      "hot and humid, still within hurricane season with unsettled weather",
      "warm and drying out, with hurricane risk fading",
      "dry and warm, one of the most pleasant months as the dry season returns"
    ], searchAliases: ['Nassau', 'Exuma'] },
);
RAW_DESTINATIONS.push(
  { id: 'palawan', name: 'Palawan', region: 'Philippines', emoji: '🛶', climate: 'tropical',
    about: 'Limestone cliffs and lagoons; dry season Nov–May (best Jan–Apr) is calm and clear, monsoon Jun–Oct brings storms and rougher seas.',
    base: { sunbathing:9, swimming:9, diving:9, surfing:3, sailing:7, hiking:4, scenic:8, fishing:6, roadtrip:3, adventure:4, golf:2, stargazing:5, museums:1, architecture:1, festivals:2, finedining:5, streetfood:6, nightlife:3, winetasting:1, spa:6, snowsports:0, cycling:2, shopping:2, birding:7, wildlife:6 },
    activityStyleTiers: { scenic: { coastlines: 'signature', forests: 'casual', mountains: 'none', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate'],
    dry: [1,2,3,4,11,12], wet: [6,7,8,9], peak: [12,1,2,3], low: [6,7,8,9], swimHazard: [7,8,9], naSliders: ['snowsports', 'museums', 'architecture', 'winetasting'],
    monthlyWeather: [
      "dry and warm, calm seas with clear skies",
      "dry and warm, among the driest, calmest months of the year",
      "dry and warm, still excellent conditions for island-hopping",
      "dry and warm, one of the best months before the heat intensifies",
      "hot and increasingly humid, as the monsoon approaches",
      "hot and rainy, with the monsoon bringing rougher seas",
      "hot and rainy, still within the wet season with regular storms",
      "hot and rainy, with unsettled seas and frequent downpours",
      "hot and rainy, still deep in the monsoon season",
      "hot and rainy, the wettest month with the roughest seas",
      "warm and drying out, as the dry season begins to return",
      "dry and warm, calm seas returning for the best season ahead"
    ], searchAliases: ['El Nido', 'Coron', 'Philippines'] },
  { id: 'rajaampat', name: 'Raja Ampat', region: 'Indonesia', emoji: '🐢', climate: 'tropical',
    about: 'Peak marine and bird biodiversity on Earth; Oct–Apr has the calmest seas and clearest diving, the southeast monsoon (Jun–Sep) brings rougher water.',
    base: { sunbathing:6, swimming:9, diving:10, surfing:2, sailing:6, hiking:4, scenic:8, fishing:6, roadtrip:1, adventure:3, golf:1, stargazing:6, museums:1, architecture:1, festivals:1, finedining:3, streetfood:3, nightlife:1, winetasting:1, spa:3, snowsports:0, cycling:1, shopping:1, birding:6, wildlife:7 },
    activityStyleTiers: { scenic: { coastlines: 'signature', forests: 'casual', mountains: 'none', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded'], physicalBands: ['easy','moderate'],
    dry: [10,11,12,1,2,3,4], wet: [6,7,8], peak: [10,11,12,1], peakIntensity: 'mild', low: [6,7],
    sliderEvents: { wildlife: [
      { label: 'Calm seas & clear diving visibility', weight: 2.5, months: { 10: 0.5, 11: 0.85, 12: 1, 1: 1, 2: 1, 3: 0.85, 4: 0.5 } },
    ], birding: [
      { label: 'Calm seas for remote birding sites', weight: 3.5, months: { 1: 1, 2: 1, 3: 0.7, 4: 0.4, 10: 0.4, 11: 0.7, 12: 1 } },
    ] }, naSliders: ['snowsports', 'museums', 'architecture', 'festivals', 'nightlife', 'shopping', 'winetasting'],
    monthlyWeather: [
      "warm and calm, with glassy seas and excellent visibility",
      "warm and calm, among the clearest, calmest months for diving",
      "warm and calm, still excellent conditions with manta activity high",
      "warm, with conditions still good before the wind season builds",
      "warm, with rain increasing as the wet season approaches",
      "warm and rainy, with the southeast monsoon bringing rougher water",
      "warm and stormy, one of the wettest, windiest months",
      "warm and stormy, still within the roughest stretch of the year",
      "warm, with rain gradually easing and seas beginning to calm",
      "warm and calming, with visibility improving as the monsoon fades",
      "warm and clear, with conditions improving toward the calm season",
      "warm and calm, with glassy seas and manta activity building"
    ], searchAliases: ['Indonesia', 'Papua'] },
  { id: 'swissalps', name: 'Zermatt & the Swiss Alps', region: 'Switzerland', emoji: '🎿', climate: 'polar',
    about: 'Matterhorn views year-round; winter is prime skiing, summer (Jun–Sep) is prime hiking, and the shoulder "mud season" sees many lifts and hotels close.',
    base: { sunbathing:2, swimming:1, diving:1, surfing:1, sailing:1, hiking:3, scenic:9, fishing:4, roadtrip:6, adventure:7, golf:2, stargazing:7, museums:4, architecture:5, festivals:4, finedining:7, streetfood:4, nightlife:5, winetasting:5, spa:7, snowsports:9, cycling:5, shopping:5, birding:4, wildlife:4 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'strong', mountainBiking: 'strong', gravelRiding: 'casual' }, scenic: { mountains: 'signature', forests: 'casual', astrophotography: 'casual' } },
    budgetBands: ['highend','luxury'], vibeBands: ['secluded','easygoing'], physicalBands: ['moderate','active','challenging'],
    peak: [7,8,12,1,2], low: [4,5,10,11], shopClosures: true,
    hikingBest: [6,7,8,9], hikingWorst: [11,12,1,2,3,4], cold: [11,12,1,2,3], noSnow: [6,7,8,9], sliderEvents: { hiking: [
      { label: 'Summer trail access', weight: 6, months: { 6: 0.7, 7: 1, 8: 1, 9: 0.7 } },
    ], scenic: [
      { label: 'Green-summer contrast', weight: 1, months: { 6: 0.3, 7: 0.5, 8: 0.5, 9: 0.3 } },
    ] }, naSliders: ['swimming', 'surfing', 'diving', 'sailing'],
    monthlyWeather: [
      "cold and snowy, deep in ski season with reliable powder",
      "cold and snowy, still prime ski season with long daylight returning",
      "cold but brightening, with good snow still on the slopes",
      "cold at altitude, with lower-elevation snow melting fast as lifts start closing",
      "cool and often wet, deep in mud season with many lifts and hotels closed",
      "mild in the valley but still cool at altitude, with trails reopening as snow clears",
      "mild and increasingly clear, one of the best months for hiking with alpine meadows in bloom",
      "mild and pleasant, still prime hiking season with the clearest Matterhorn views",
      "cool and clear, still excellent for hiking as crowds thin",
      "cool and increasingly wet, deep in mud season again as trails start closing",
      "cold, with the first snow arriving as the resort prepares to reopen",
      "cold and snowy, with ski season back in full swing"
    ], searchAliases: ['Zermatt', 'Matterhorn', 'Switzerland'] },
  { id: 'aspen', name: 'Aspen', region: 'Colorado, USA', emoji: '⛷️', climate: 'polar',
    about: 'World-class ski town; winter (Dec–Mar) is the main draw, summer brings hiking and music festivals, shoulder months see many businesses close.',
    base: { sunbathing:2, swimming:1, diving:1, surfing:1, sailing:1, hiking:7, scenic:8, fishing:4, roadtrip:5, adventure:6, golf:3, stargazing:6, museums:3, architecture:3, festivals:5, finedining:8, streetfood:4, nightlife:6, winetasting:5, spa:7, snowsports:10, cycling:4, shopping:6, birding:4, wildlife:4 },
    activityStyleTiers: { cycling: { mountainBiking: 'strong', scenicRoadCycling: 'strong', gravelRiding: 'casual' }, scenic: { mountains: 'signature', forests: 'strong', coastlines: 'none', deserts: 'none', astrophotography: 'casual' } },
    budgetBands: ['highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['moderate','active','challenging'],
    peak: [12,1,2,7], low: [4,5,10,11], shopClosures: true,
    hikingBest: [6,7,8,9], hikingWorst: [11,12,1,2,3,4], cold: [11,12,1,2,3], noSnow: [6,7,8,9], sliderEvents: { scenic: [
      { label: 'Alpine-lake summer', weight: 1.5, months: { 6: 0.5, 7: 0.85, 8: 0.85, 9: 0.5 } },
    ] }, naSliders: ['swimming', 'surfing', 'diving', 'sailing'],
    monthlyWeather: [
      "bitterly cold, deep in ski season with reliable powder",
      "bitterly cold, still prime ski season with long daylight returning",
      "cold but brightening, with good snow still on the slopes",
      "cold and often slushy, with the ski season winding down and many businesses closing",
      "cool and quiet, deep in the off-season with trails still muddy at higher elevations",
      "mild and dry, with hiking trails opening up and music festivals beginning",
      "warm and dry, one of the best months for hiking and outdoor festivals",
      "warm and dry, still prime hiking season with comfortable days",
      "mild and dry, with aspen groves turning gold and crowds thinning",
      "cool and quiet, deep in the off-season before ski season ramps up",
      "cold, with the first snow arriving as the resort prepares to open",
      "cold and snowy, with ski season back in full swing"
    ], searchAliases: ['Colorado'] },
  { id: 'whistler', name: 'Whistler', region: 'Canada', emoji: '🏔️', climate: 'polar',
    about: 'North America’s largest ski resort in winter; summer opens up hiking, mountain biking and alpine lakes.',
    base: { sunbathing:2, swimming:2, diving:1, surfing:1, sailing:2, hiking:3, scenic:8, fishing:4, roadtrip:5, adventure:8, golf:4, stargazing:6, museums:2, architecture:2, festivals:4, finedining:6, streetfood:4, nightlife:6, winetasting:3, spa:6, snowsports:10, cycling:5, shopping:5, birding:4, wildlife:5 },
    activityStyleTiers: { cycling: { mountainBiking: 'signature', scenicRoadCycling: 'casual', gravelRiding: 'casual' }, scenic: { mountains: 'strong', forests: 'strong', astrophotography: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['moderate','active','challenging'],
    peak: [12,1,2,7,8], low: [4,5,10,11], shopClosures: true,
    hikingBest: [6,7,8,9], hikingWorst: [11,12,1,2,3,4], cold: [11,12,1,2,3], noSnow: [6,7,8,9], sliderEvents: { hiking: [
      { label: 'Summer trail access', weight: 6, months: { 6: 0.7, 7: 1, 8: 1, 9: 0.7 } },
    ], scenic: [
      { label: 'Alpine-lake summer', weight: 1.5, months: { 6: 0.5, 7: 0.85, 8: 0.85, 9: 0.5 } },
    ] }, naSliders: ['swimming', 'surfing', 'diving', 'sailing', 'museums', 'architecture'],
    monthlyWeather: [
      "cold and snowy, deep in ski season with the year's best snowpack",
      "cold and snowy, still prime ski season",
      "cold and still snowy, one of the snowiest months on the slopes",
      "cool and still wintry at altitude, with the ski season extending into spring",
      "mild in the valley, with the village turning green as snow lingers up high",
      "mild and increasingly dry, one of the best months as summer trails open",
      "warm and mostly dry, prime season for hiking and mountain biking",
      "warm and dry, still excellent for outdoor activities",
      "mild and crisp, with beautiful \"Indian summer\" days and thinning crowds",
      "cool and increasingly wet, as the rains return",
      "cold and wet, the wettest month with the first heavy snow at higher elevations",
      "cold and snowy, with ski season back underway"
    ], searchAliases: ['British Columbia', 'Canada'] },
  { id: 'banff', name: 'Banff National Park', region: 'Canada', emoji: '🏞️', climate: 'polar',
    about: 'Turquoise glacial lakes in the Canadian Rockies; summer (Jun–Sep) is prime for hiking and wildlife, winter draws skiers but most trails close.',
    base: { sunbathing:2, swimming:2, diving:1, surfing:1, sailing:2, hiking:3, scenic:8, fishing:6, roadtrip:8, adventure:7, golf:4, stargazing:7, museums:2, architecture:2, festivals:3, finedining:5, streetfood:3, nightlife:3, winetasting:2, spa:5, snowsports:9, cycling:5, shopping:4, birding:5, wildlife:5 },
    activityStyleTiers: { cycling: { mountainBiking: 'strong', scenicRoadCycling: 'strong', gravelRiding: 'casual' }, scenic: { mountains: 'signature', forests: 'strong', astrophotography: 'casual' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded','easygoing'], physicalBands: ['moderate','active','challenging'],
    peak: [7,8,12,1], peakIntensity: 'extreme', low: [4,5,10,11],
    hikingBest: [6,7,8,9], hikingWorst: [11,12,1,2,3,4], cold: [11,12,1,2,3], noSnow: [6,7,8,9], wildlifePeak: [5,6,9,10], sliderCaps: { wildlife: 8 }, sliderEvents: { hiking: [
      { label: 'Summer trail access', weight: 6, months: { 6: 0.7, 7: 1, 8: 1, 9: 0.7 } },
    ], scenic: [
      { label: 'Turquoise-lake summer', weight: 1.5, months: { 6: 0.5, 7: 0.85, 8: 0.85, 9: 0.5 } },
    ] }, naSliders: ['swimming', 'surfing', 'diving', 'sailing', 'museums', 'architecture'],
    monthlyWeather: [
      "bitterly cold, with deep snow and prime conditions for skiing",
      "bitterly cold, still excellent for skiing and winter scenery",
      "cold, with good snow still on the slopes as days lengthen",
      "cool and still wintry, with trails beginning to reopen as snow recedes",
      "mild and greening up, with wildlife becoming more active",
      "mild, though the rainiest month of the year with regular showers",
      "warm, one of the best months for hiking with trails fully open",
      "warm and pleasant, still prime hiking season",
      "cool and crisp, a favorite shoulder month with fewer crowds",
      "cool and quiet, with the first snow returning at higher elevations",
      "cold, with winter setting back in fast",
      "bitterly cold, with deep snow and ski season underway"
    ], searchAliases: ['Alberta', 'Canada', 'Lake Louise'] },
  { id: 'queenstown', name: 'Queenstown', region: 'New Zealand', emoji: '🚣', climate: 'temperate',
    about: 'Adventure capital with a dual season: winter (Jun–Sep) for skiing, summer (Dec–Feb) for hiking, bungee and lake activities.',
    base: { sunbathing:4, swimming:3, diving:2, surfing:2, sailing:4, hiking:4, scenic:8, fishing:5, roadtrip:8, adventure:10, golf:6, stargazing:6, museums:2, architecture:2, festivals:4, finedining:7, streetfood:4, nightlife:6, winetasting:6, spa:5, snowsports:9, cycling:6, shopping:5, birding:5, wildlife:4 },
    activityStyleTiers: { cycling: { mountainBiking: 'strong', scenicRoadCycling: 'strong', gravelRiding: 'strong' }, scenic: { mountains: 'signature', forests: 'casual', astrophotography: 'strong' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['moderate','active','challenging'],
    hot: [], cold: [6,7,8], peak: [12,1,7,8], low: [4,5,10,11],
    hikingBest: [12,1,2,3], hikingWorst: [6,7,8], noSnow: [12,1,2,3], sliderEvents: { hiking: [
      { label: 'Summer trail access', weight: 5, months: { 1: 1, 2: 1, 3: 0.6, 12: 0.8 } },
    ], scenic: [
      { label: 'Summer lake & mountain clarity', weight: 1.5, months: { 1: 0.85, 2: 0.85, 3: 0.5, 12: 0.5 } },
    ] }, naSliders: ['surfing', 'diving', 'museums', 'architecture'],
    monthlyWeather: [
      "warm and settled, the most reliable stretch of a mild Southern Hemisphere summer",
      "warm and sunny, still one of the best months with long daylight",
      "mild and cooling, with the first hints of autumn color",
      "cool and crisp, with the region's famous golden foliage in full display",
      "cool and increasingly wet, as autumn gives way to winter",
      "cold, with ski season beginning on the surrounding mountains",
      "the coldest month, cold with reliable snow for skiing",
      "cold, still deep in ski season with crisp, clear days common",
      "cool and unsettled, with spring arriving unevenly",
      "cool and wet, the wettest month of the year",
      "mild and increasingly pleasant, with summer building",
      "warm and settled, as the summer season gets underway"
    ], searchAliases: ['New Zealand', 'South Island'] },
  { id: 'rwanda', name: 'Rwanda', region: 'East Africa', emoji: '🦍', climate: 'highland',
    about: 'Mountain gorilla trekking; the two dry seasons (Jun–Sep and Dec–Feb) offer easier, less muddy trekking conditions.',
    base: { sunbathing:1, swimming:1, diving:1, surfing:1, sailing:1, hiking:7, scenic:7, fishing:1, roadtrip:4, adventure:4, golf:1, stargazing:4, museums:4, architecture:2, festivals:3, finedining:3, streetfood:3, nightlife:2, winetasting:1, spa:2, snowsports:0, cycling:2, shopping:2, birding:7, wildlife:8 },
    activityStyleTiers: { scenic: { mountains: 'strong', forests: 'signature', coastlines: 'none', deserts: 'none', astrophotography: 'casual' } },
    budgetBands: ['highend','luxury'], vibeBands: ['secluded'], physicalBands: ['moderate','active','challenging'],
    dry: [6,7,8,9,12,1,2], wet: [3,4,5,10,11], peak: [6,7,8,12,1], peakIntensity: 'mild', low: [4,5],
    sliderEvents: { wildlife: [
      { label: 'Easier, drier trekking trails', weight: 1.5, months: { 6: 0.6, 7: 1, 8: 1, 9: 0.6, 12: 0.6, 1: 1, 2: 1 } },
    ], birding: [
      { label: 'Drier trails', weight: 1.5, months: { 1: 1, 2: 1, 6: 0.6, 7: 1, 8: 1, 9: 0.6, 12: 0.6 } },
    ] }, specialSeasons: [{ months: [6,7,8,9,12,1,2], text: "Drier trails make gorilla trekking through Volcanoes National Park easier and less strenuous." }], naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'sailing', 'winetasting'],
    monthlyWeather: [
      "mild and relatively dry, good trekking conditions with cool mountain air",
      "mild and dry, still one of the better months for trekking",
      "mild, with rain increasingly likely on the volcano slopes",
      "mild and wet, one of the rainiest months with muddy trails",
      "mild and wet, still within the wetter stretch of the year",
      "mild and dry, with trails firming up for easier trekking",
      "mild and dry, one of the best months for gorilla trekking",
      "mild and dry, still excellent trekking conditions",
      "mild, with rain returning as the wetter season begins again",
      "mild and wet, with trails softening again",
      "mild and wet, still within the rainier stretch of the year",
      "mild and drying out, as the short dry season begins"
    ], searchAliases: ['gorilla trekking'] },
  { id: 'uganda', name: 'Bwindi & Kibale', region: 'Uganda', emoji: '🦧', climate: 'highland',
    about: 'Gorilla and chimp trekking plus outstanding birding; dry seasons (Jun–Aug, Dec–Feb) make for firmer, less strenuous trails.',
    base: { sunbathing:1, swimming:1, diving:1, surfing:1, sailing:1, hiking:7, scenic:7, fishing:2, roadtrip:4, adventure:4, golf:1, stargazing:4, museums:3, architecture:2, festivals:3, finedining:3, streetfood:3, nightlife:2, winetasting:1, spa:2, snowsports:0, cycling:2, shopping:2, birding:7, wildlife:8 },
    activityStyleTiers: { scenic: { mountains: 'strong', forests: 'signature', coastlines: 'none', deserts: 'none', astrophotography: 'casual' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded'], physicalBands: ['moderate','active','challenging'],
    dry: [6,7,8,12,1,2], wet: [3,4,5,9,10,11], peak: [6,7,8,12,1], peakIntensity: 'mild', low: [4,5],
    sliderEvents: { wildlife: [
      { label: 'Easier, drier trekking trails', weight: 1.5, months: { 6: 1, 7: 1, 8: 0.6, 12: 0.6, 1: 1, 2: 1 } },
    ], birding: [
      { label: 'Drier trails', weight: 1.5, months: { 1: 1, 2: 1, 6: 1, 7: 1, 8: 0.6, 12: 0.6 } },
    ] }, specialSeasons: [{ months: [6,7,8,12,1,2], text: "Drier trails make gorilla and chimpanzee trekking easier and less strenuous." }], naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'sailing', 'winetasting'],
    monthlyWeather: [
      "mild and relatively dry, good for trekking with cooler mountain air",
      "mild and dry, still favorable trekking conditions",
      "mild, with rain becoming more frequent",
      "mild and wet, one of the rainiest months with muddy, tough trails",
      "mild and wet, still within the wetter stretch of the year",
      "mild and dry, with trails firming up",
      "mild and dry, one of the driest, most popular trekking months",
      "mild and dry, still excellent for trekking",
      "mild, with rain returning as the wetter season begins",
      "mild and wet, with trails softening again",
      "mild and wet, still within the rainier stretch of the year",
      "mild and drying out, as the short dry season begins"
    ], searchAliases: ['Bwindi', 'gorilla trekking'] },
  { id: 'zambia', name: 'South Luangwa & Victoria Falls', region: 'Zambia', emoji: '🐘', climate: 'tropical',
    about: 'Walking-safari birthplace plus Victoria Falls; dry season (May–Oct) concentrates wildlife, while the Falls themselves are most powerful just after the rains (Mar–May).',
    base: { sunbathing:2, swimming:2, diving:1, surfing:1, sailing:2, hiking:5, scenic:7, fishing:4, roadtrip:4, adventure:5, golf:1, stargazing:6, museums:2, architecture:2, festivals:2, finedining:3, streetfood:3, nightlife:2, winetasting:1, spa:3, snowsports:0, cycling:2, shopping:2, birding:6, wildlife:6 },
    activityStyleTiers: { scenic: { forests: 'casual', mountains: 'none', coastlines: 'none', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded'], physicalBands: ['moderate','active'],
    dry: [5,6,7,8,9,10], wet: [12,1,2,3], peak: [7,8,9], low: [1,2,11],
    sliderEvents: { wildlife: [
      { label: 'Dry-season concentration', weight: 3.5, months: { 5: 0.3, 6: 0.7, 7: 1, 8: 1, 9: 1, 10: 0.6 } },
    ], birding: [
      { label: 'Wet-season migratory bird arrivals', weight: 3.5, months: { 1: 1, 2: 1, 3: 0.6, 11: 0.4, 12: 0.85 } },
    ] }, specialSeasons: [{ months: [3,4,5], text: "Victoria Falls are at their most powerful and dramatic now, just after the rains — though this isn't peak game-viewing season." }], naSliders: ['snowsports', 'surfing', 'diving', 'winetasting'],
    monthlyWeather: [
      "hot and wet, deep in the rainy season with frequent downpours",
      "hot and wet, still within the wettest stretch of the year",
      "hot and rainy, with the Falls building toward their most powerful flow",
      "warm and increasingly dry, with the Falls at their most spectacular and thunderous",
      "warm and dry, with the Falls still running high as the dry season settles in",
      "mild and dry, with wildlife beginning to concentrate along the rivers",
      "mild and dry, excellent wildlife viewing as water sources shrink",
      "warm and dry, still excellent for wildlife with the Falls' flow diminishing",
      "hot and dry, one of the driest, hottest months with wildlife concentrated at rivers",
      "the hottest month, dry with wildlife densely packed around remaining water",
      "hot, with the first rains returning and building humidity",
      "hot and increasingly wet, as the rainy season takes hold"
    ], searchAliases: ['Victoria Falls', 'Zimbabwe', 'Livingstone'] },
  { id: 'ethiopia', name: 'Simien Mountains', region: 'Ethiopia', emoji: '🦜', climate: 'highland',
    about: 'High-altitude trekking with endemic wildlife (gelada monkeys) and birding; dry season Oct–Mar is best for trekking, heavy rains Jun–Sep make trails difficult.',
    base: { sunbathing:1, swimming:1, diving:1, surfing:1, sailing:1, hiking:8, scenic:9, fishing:2, roadtrip:5, adventure:5, golf:1, stargazing:6, museums:8, architecture:7, festivals:6, finedining:5, streetfood:5, nightlife:3, winetasting:1, spa:2, snowsports:0, cycling:3, shopping:4, birding:6, wildlife:7 },
    activityStyleTiers: { scenic: { mountains: 'signature', forests: 'casual', deserts: 'casual', coastlines: 'none', astrophotography: 'casual' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['secluded'], physicalBands: ['moderate','active','challenging'],
    dry: [10,11,12,1,2,3], wet: [6,7,8,9], peak: [10,11,12,1], peakIntensity: 'mild', low: [6,7,8],
    hikingBest: [10,11,12,1,2,3], hikingWorst: [6,7,8,9], wildlifePeak: [10,11,12,1,2,3], sliderEvents: { birding: [
      { label: 'Dry-season trekking access', weight: 3, months: { 1: 1, 2: 1, 3: 0.6, 10: 0.4, 11: 0.7, 12: 1 } },
    ] }, naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'sailing', 'winetasting'],
    monthlyWeather: [
      "dry and clear, with cold nights at altitude dropping below freezing",
      "dry and clear, still among the coldest, clearest months",
      "dry and mild by day, with nights still cold at altitude",
      "dry and mild, one of the last good months before the rains",
      "increasingly wet, with rain becoming more frequent",
      "wet, with rain building toward the peak of the season",
      "the wettest month, with heavy rain making trails difficult",
      "still very wet, with heavy rain continuing to make trekking difficult",
      "wet early on, drying out as the month progresses",
      "dry and clear, with the landscape lush and green after the rains",
      "dry and clear, one of the best months with vivid green scenery",
      "dry and clear, mild by day with cold nights at altitude"
    ], searchAliases: ['gelada monkeys'] },
  { id: 'pantanal', name: 'Pantanal', region: 'Brazil', emoji: '🐆', climate: 'tropical',
    about: 'The world’s best jaguar-viewing; dry season Jul–Oct concentrates wildlife along riverbanks, wet season Nov–Mar floods much of the region.',
    base: { sunbathing:2, swimming:2, diving:1, surfing:1, sailing:2, hiking:4, scenic:7, fishing:7, roadtrip:4, adventure:4, golf:1, stargazing:6, museums:1, architecture:1, festivals:1, finedining:3, streetfood:3, nightlife:1, winetasting:1, spa:2, snowsports:0, cycling:1, shopping:1, birding:6, wildlife:6 },
    budgetBands: ['comfortable','highend'], vibeBands: ['secluded'], physicalBands: ['moderate','active'],
    dry: [7,8,9,10], wet: [12,1,2,3], peak: [7,8,9], peakIntensity: 'mild', low: [1,2,3],
    sliderEvents: { wildlife: [
      { label: 'Jaguar season (dry-season riverbank concentration)', weight: 4, months: { 7: 0.85, 8: 1, 9: 1, 10: 0.7 } },
    ], birding: [
      { label: 'Dry-season riverbank concentration', weight: 3, months: { 7: 0.85, 8: 1, 9: 1, 10: 0.7 } },
    ] }, specialSeasons: [{ months: [7,8,9,10], text: "This is peak jaguar season, as falling water levels concentrate wildlife along the riverbanks." }], naSliders: ['snowsports', 'surfing', 'diving', 'museums', 'architecture', 'festivals', 'nightlife', 'shopping', 'winetasting'],
    monthlyWeather: [
      "hot and wet, deep in the rainy season with much of the region flooded",
      "hot and wet, still within the wettest stretch of the year",
      "hot and rainy, with flooding still widespread",
      "warm and increasingly dry, as floodwaters begin to recede",
      "warm and drying out, with wildlife beginning to concentrate near remaining water",
      "mild and dry, with mornings and evenings turning chilly",
      "mild and dry, with clear skies and comfortable temperatures for full days outdoors",
      "warm and dry, one of the sunniest, most reliable stretches of the year",
      "hot and dry, with water sources shrinking fast across the region",
      "the hottest month, dry with heat building steadily ahead of the first rains",
      "hot, with the first rains returning as the wet season begins",
      "hot and increasingly wet, as the rainy season takes hold"
    ], searchAliases: ['Brazil', 'jaguars'] },
);
RAW_DESTINATIONS.push(
  { id: 'yellowstone', name: 'Yellowstone National Park', region: 'USA', emoji: '🐺', climate: 'temperate',
    about: 'Geysers and wildlife; summer (Jun–Aug) opens all roads and facilities, spring brings newborn wildlife and fall the elk rut, winter access is limited to guided snow tours.',
    base: { sunbathing:2, swimming:1, diving:1, surfing:1, sailing:2, hiking:3, scenic:7, fishing:7, roadtrip:8, adventure:5, golf:1, stargazing:7, museums:2, architecture:1, festivals:2, finedining:3, streetfood:2, nightlife:1, winetasting:1, spa:2, snowsports:4, cycling:3, shopping:2, birding:6, wildlife:7 },
    activityStyleTiers: { scenic: { forests: 'signature', mountains: 'strong', astrophotography: 'casual', deserts: 'none', coastlines: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['secluded'], physicalBands: ['moderate','active','challenging'],
    dry: [6,7,8,9], hot: [], cold: [11,12,1,2,3], peak: [7,8], peakIntensity: 'extreme', low: [4,5,10,11],
    hikingBest: [6,7,8,9], hikingWorst: [11,12,1,2,3,4], birdingPeak: [5,6], sliderCaps: { birding: 7 }, sliderEvents: { wildlife: [
      { label: 'Newborn wildlife (spring)', weight: 3, months: { 5: 1, 6: 0.5 } },
      { label: 'Elk rut (fall)', weight: 3, months: { 9: 1, 10: 0.5 } },
    ], hiking: [
      { label: 'Summer trail & road access', weight: 6, months: { 6: 0.7, 7: 1, 8: 1, 9: 0.7 } },
    ], scenic: [
      { label: 'Full summer road access', weight: 2.5, months: { 6: 0.5, 7: 0.85, 8: 0.85, 9: 0.5 } },
    ] }, specialSeasons: [{ months: [5,6], text: "Newborn bison, elk and bear cubs are common sights this time of year." }, { months: [9,10], text: "The elk rut is in full swing, with bulls bugling to attract mates." }], naSliders: ['swimming', 'surfing', 'diving', 'sailing', 'museums', 'architecture', 'festivals', 'nightlife', 'winetasting'],
    monthlyWeather: [
      "bitterly cold, with deep snow and most roads open only to guided snow tours",
      "bitterly cold, still deep winter with limited road access",
      "cold, with winter still firmly in control and most interior roads closed",
      "cold and muddy, as snow begins melting but many roads remain closed",
      "cool and unsettled, with roads reopening and newborn wildlife appearing",
      "mild, with all roads open and wildflowers emerging, though nights stay cool",
      "warm and dry, the warmest month with reliable sunny days",
      "warm and dry, still excellent conditions though afternoon storms are possible",
      "cool and crisp, with the elk rut beginning and crowds thinning",
      "cool, with snow returning at higher elevations and facilities starting to close",
      "cold, with most roads closing again as winter sets in",
      "bitterly cold, with deep snow and access limited to guided snow tours"
    ], searchAliases: ['Wyoming', 'Old Faithful', 'Grand Teton'] },
  { id: 'grandcanyon', name: 'Grand Canyon', region: 'Arizona, USA', emoji: '🦅', climate: 'desert',
    about: 'Year-round but extreme; spring and fall are ideal for hiking with mild rim temps, summer inner-canyon heat is dangerous, the North Rim closes in winter.',
    base: { sunbathing:4, swimming:1, diving:1, surfing:1, sailing:1, hiking:7, scenic:8, fishing:2, roadtrip:8, adventure:6, golf:2, stargazing:8, museums:3, architecture:2, festivals:1, finedining:3, streetfood:2, nightlife:1, winetasting:1, spa:2, snowsports:1, cycling:2, shopping:2, birding:4, wildlife:5 },
    activityStyleTiers: { scenic: { deserts: 'strong', astrophotography: 'casual', mountains: 'none', forests: 'none', coastlines: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['secluded'], physicalBands: ['easy','moderate','active','challenging'],
    hot: [6,7,8], cold: [12,1,2], peak: [6,7,8], low: [12,1,2],
    hikingBest: [4,5,10,11], hikingWorst: [6,7,8,12,1,2], sliderEvents: { scenic: [
      { label: 'Mild-temperature clarity', weight: 1.5, months: { 4: 0.7, 5: 0.85, 10: 0.85, 11: 0.7 } },
    ] }, naSliders: ['swimming', 'surfing', 'diving', 'sailing', 'architecture', 'festivals', 'nightlife', 'winetasting'],
    monthlyWeather: [
      "cold at the rim, with snow possible and mild days deep in the canyon",
      "cold at the rim, still prone to snow though inner-canyon days are pleasant",
      "cool at the rim and increasingly mild in the canyon, one of the best months",
      "mild at the rim, warm in the canyon, among the driest and most pleasant months",
      "mild at the rim and heating up fast in the canyon, still comfortable overall",
      "warm at the rim but dangerously hot in the inner canyon",
      "warm at the rim, with inner-canyon temperatures regularly exceeding 100°F",
      "warm at the rim, still dangerously hot below the rim with monsoon storms possible",
      "mild and pleasant at the rim, with the inner canyon cooling to safer levels",
      "cool and crisp at the rim, one of the best months with colorful fall light",
      "cold at the rim, with the North Rim now closed for the season",
      "cold and often snowy at the rim, with mild days still possible in the inner canyon"
    ], searchAliases: ['Arizona'] },
  { id: 'churchill', name: 'Churchill', region: 'Manitoba, Canada', emoji: '🐻‍❄️', climate: 'polar',
    about: '"Polar Bear Capital of the World" — bears gather near the coast Oct–Nov waiting for sea ice, and beluga whales fill the river Jul–Aug.',
    base: { sunbathing:0, swimming:1, diving:1, surfing:1, sailing:1, hiking:2, scenic:6, fishing:3, roadtrip:2, adventure:3, golf:0, stargazing:5, museums:1, architecture:1, festivals:1, finedining:2, streetfood:1, nightlife:1, winetasting:1, spa:1, snowsports:3, cycling:0, shopping:1, birding:5, wildlife:1 },
    activityStyleTiers: { scenic: { coastlines: 'strong', astrophotography: 'signature', mountains: 'none', forests: 'casual', deserts: 'none' } },
    budgetBands: ['highend','luxury'], vibeBands: ['secluded'], physicalBands: ['moderate','active'],
    cold: [12,1,2,3], peak: [10,11], peakIntensity: 'mild', low: [3,4,5],
    birdingPeak: [6,7], sliderCaps: { birding: 7 }, sliderEvents: { wildlife: [
      { label: 'Polar bears', weight: 7, months: { 9: 0.3, 10: 1, 11: 1, 12: 0.15 } },
      { label: 'Beluga whales', weight: 3.5, months: { 7: 1, 8: 1 } },
    ], stargazing: [
      { label: 'Long winter nights (aurora season)', weight: 4, months: { 1: 1, 2: 0.85, 3: 0.5, 11: 0.5, 12: 0.85 } },
    ] }, specialSeasons: [{ months: [10,11], text: "Polar bears gather along the coast waiting for Hudson Bay to freeze — the peak bear-viewing window." }, { months: [7,8], text: "Thousands of beluga whales fill the Churchill River estuary, often approachable by kayak." }], naSliders: ['swimming', 'surfing', 'diving', 'sailing', 'golf', 'cycling', 'museums', 'architecture', 'festivals', 'nightlife', 'shopping', 'winetasting'],
    monthlyWeather: [
      "bitterly cold, deep winter with temperatures often well below freezing",
      "bitterly cold, still deep in the harsh subarctic winter",
      "cold, with winter still firmly in control",
      "cold, with the ice beginning to loosen its grip",
      "cool, as the tundra starts to thaw",
      "mild, with beluga whales arriving in the river in large numbers",
      "mild, with long daylight hours and comfortable temperatures for full days outdoors",
      "mild, with warm afternoons giving way to crisp evenings",
      "cool, with the tundra turning gold as polar bears begin gathering",
      "cool and increasingly cold, with the tundra fully bare and days growing short",
      "cold, with Hudson Bay visibly icing over along the shoreline",
      "bitterly cold, with winter fully returned and the bay freezing over"
    ], searchAliases: ['Manitoba', 'polar bears', 'Hudson Bay'] },
  { id: 'falklands', name: 'Falkland Islands', region: 'South Atlantic', emoji: '🐧', climate: 'polar',
    about: 'Five penguin species and huge albatross colonies; the austral summer (Oct–Mar) is breeding/chick season and the only practical visiting window.',
    base: { sunbathing:1, swimming:1, diving:1, surfing:1, sailing:2, hiking:5, scenic:8, fishing:4, roadtrip:4, adventure:3, golf:1, stargazing:5, museums:2, architecture:2, festivals:1, finedining:3, streetfood:2, nightlife:1, winetasting:1, spa:1, snowsports:0, cycling:1, shopping:1, birding:5, wildlife:5 },
    activityStyleTiers: { scenic: { coastlines: 'signature', astrophotography: 'strong', mountains: 'casual', forests: 'none', deserts: 'none' } },
    budgetBands: ['highend','luxury'], vibeBands: ['secluded'], physicalBands: ['moderate','active'],
    cold: [6,7,8], peak: [12,1], peakIntensity: 'mild', low: [5,6,7,8],
    sliderEvents: { wildlife: [
      { label: 'Penguin & albatross breeding season', weight: 4, months: { 10: 0.5, 11: 0.85, 12: 1, 1: 1, 2: 0.85, 3: 0.5 } },
    ], birding: [
      { label: 'Penguin & albatross breeding season', weight: 4, months: { 1: 1, 2: 0.85, 3: 0.5, 10: 0.5, 11: 0.85, 12: 1 } },
    ], stargazing: [
      { label: 'Longer southern-winter nights', weight: 2, months: { 6: 0.7, 7: 1, 8: 0.7 } },
    ] }, specialSeasons: [{ months: [11,12,1,2], text: "This is peak breeding season for penguins and albatross, with colonies full of eggs and chicks." }], naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'sailing', 'golf', 'cycling', 'museums', 'architecture', 'festivals', 'nightlife', 'shopping', 'winetasting'],
    monthlyWeather: [
      "cool, the mildest month with breeding season in full swing",
      "cool, still one of the warmest, most active months for penguins and albatross",
      "cool, with wildlife still abundant as summer winds down",
      "cool and increasingly windy, with wildlife activity easing",
      "cold, as the islands head into their coldest stretch",
      "cold, deep in the sub-polar winter",
      "cold, still firmly in the coldest part of the year",
      "cold, with winter beginning to loosen its grip late in the month",
      "cold and windy, one of the driest but breeziest months",
      "cool and windy, with penguin colonies beginning to form",
      "cool and windy, with breeding season underway across the islands",
      "cool, warming into the mildest, most active wildlife season"
    ], searchAliases: ['Falkland Islands', 'penguins'] },
  { id: 'kaziranga', name: 'Kaziranga National Park', region: 'Assam, India', emoji: '🦏', climate: 'tropical',
    about: 'One-horned rhino stronghold. The park closes entirely during monsoon flooding (roughly May–Oct), reopening for dry-season game drives Nov–Apr.',
    base: { sunbathing:1, swimming:1, diving:1, surfing:1, sailing:1, hiking:3, scenic:6, fishing:2, roadtrip:3, adventure:3, golf:1, stargazing:3, museums:2, architecture:2, festivals:3, finedining:3, streetfood:5, nightlife:1, winetasting:1, spa:2, snowsports:0, cycling:1, shopping:2, birding:4, wildlife:6 },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['secluded'], physicalBands: ['easy','moderate'],
    dry: [11,12,1,2,3,4], wet: [6,7,8,9], peak: [12,1,2], peakIntensity: 'mild', low: [11,4],
    wildlifeClosed: [5,6,7,8,9], sliderEvents: { wildlife: [
      { label: 'Dry-season grass-cutting visibility', weight: 3, months: { 11: 0.4, 12: 1, 1: 1, 2: 1, 3: 0.7, 4: 0.3 } },
    ], birding: [
      { label: 'Dry-season access', weight: 5, months: { 1: 1, 2: 1, 3: 0.7, 4: 0.3, 11: 0.4, 12: 0.9 } },
    ] }, specialSeasons: [{ months: [12,1,2,3], text: "Dry-season grass cutting improves visibility for spotting the park's one-horned rhinos." }], naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'sailing', 'nightlife', 'winetasting'],
    monthlyWeather: [
      "cool and dry, one of the best months with mild days and cold nights",
      "mild and dry, still excellent conditions for game drives",
      "warming up, dry with increasingly hot days",
      "hot and humid, with the heat building steadily",
      "hot and humid, still open though conditions are increasingly uncomfortable",
      "hot and wet, with the park closing as monsoon flooding begins",
      "hot and rainy, with the park closed and much of the area flooded",
      "hot and rainy, still closed with flooding at its worst",
      "hot and rainy, still closed as the monsoon lingers",
      "warm and drying out, with the park reopening as floodwaters recede",
      "mild and dry, one of the best months as the cool season begins",
      "cool and dry, mild days and cold nights with excellent visibility"
    ], searchAliases: ['Assam', 'rhinos'] },
  { id: 'komodo', name: 'Komodo Island', region: 'Indonesia', emoji: '🐉', climate: 'tropical',
    about: 'Komodo dragons plus superb diving; dry season Apr–Dec has calmer seas and better visibility, wet season Jan–Mar brings rain and rougher crossings.',
    base: { sunbathing:7, swimming:9, diving:9, surfing:3, sailing:8, hiking:5, scenic:8, fishing:5, roadtrip:2, adventure:5, golf:1, stargazing:5, museums:1, architecture:1, festivals:1, finedining:4, streetfood:4, nightlife:2, winetasting:1, spa:4, snowsports:0, cycling:1, shopping:1, birding:6, wildlife:7 },
    activityStyleTiers: { scenic: { coastlines: 'strong', mountains: 'casual', deserts: 'casual', forests: 'none', astrophotography: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate','active'],
    dry: [4,5,6,7,8,9,10,11,12], wet: [1,2,3], peak: [7,8], low: [1,2],
    sliderEvents: { wildlife: [
      { label: 'Calm seas & clear diving conditions', weight: 2.5, months: { 4: 0.5, 5: 0.7, 6: 0.85, 7: 1, 8: 1, 9: 0.85, 10: 0.7, 11: 0.5, 12: 0.3 } },
    ] }, naSliders: ['snowsports', 'museums', 'architecture', 'festivals', 'shopping', 'winetasting'],
    monthlyWeather: [
      "hot and wet, the wettest month with rough seas and reduced visibility",
      "hot and wet, still within the rainiest stretch with manta rays gathering",
      "hot and rainy, with rain beginning to ease later in the month",
      "warm and drying out, one of the best months as seas calm and visibility improves",
      "warm and dry, with excellent conditions and whale sharks passing through",
      "warm and dry, pleasant with calm seas and low humidity",
      "warm and dry, excellent diving conditions with clear visibility",
      "warm and dry, still excellent though the busiest month for crowds",
      "warm and dry, still excellent diving conditions with fewer crowds",
      "warm and dry, still good conditions before the rains return",
      "warm, with rain beginning to return and manta season starting in the south",
      "warm and increasingly wet, as the rainy season sets back in"
    ], searchAliases: ['Flores', 'Komodo dragons', 'Indonesia'] },
  { id: 'jordan', name: 'Petra & Wadi Rum', region: 'Jordan', emoji: '🏜️', climate: 'desert',
    about: 'Rose-red ruins and desert camps; spring and fall are mild and ideal, summer desert heat is intense, winter nights in Wadi Rum can be near-freezing.',
    base: { sunbathing:3, swimming:2, diving:4, surfing:1, sailing:2, hiking:7, scenic:6, fishing:2, roadtrip:7, adventure:6, golf:1, stargazing:8, museums:10, architecture:10, festivals:4, finedining:6, streetfood:6, nightlife:3, winetasting:2, spa:4, snowsports:0, cycling:2, shopping:5, birding:5, wildlife:3 },
    activityStyleTiers: { scenic: { deserts: 'signature', mountains: 'casual', coastlines: 'none', forests: 'none', astrophotography: 'strong' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate','active'],
    dry: [3,4,5,10,11], hot: [6,7,8], cold: [12,1,2], peak: [3,4,10,11], low: [7,8],
    hikingBest: [3,4,5,10,11], hikingWorst: [6,7,8], sliderEvents: { scenic: [
      { label: 'Mild-temperature clarity', weight: 3, months: { 3: 0.7, 4: 1, 5: 0.6, 10: 0.85, 11: 0.7 } },
    ] }, naSliders: ['surfing'],
    monthlyWeather: [
      "cold, especially at night, with occasional rain and near-freezing desert nights",
      "cold, still chilly with nights near freezing in Wadi Rum",
      "mild by day but still cool at night, one of the best months",
      "warm and dry, with the desert's rose-red light at its most striking",
      "warm and dry, still comfortable before the summer heat builds",
      "hot and dry, with intense midday sun",
      "scorching and dry, one of the hottest, driest months",
      "scorching and dry, still intensely hot with clear skies",
      "hot and dry, with the heat beginning to ease",
      "warm and dry, one of the best months with comfortable days",
      "mild by day but cold at night, comfortable for exploring",
      "cold, especially at night, with near-freezing desert temperatures"
    ], searchAliases: ['Petra', 'Wadi Rum', 'Amman'] },
  { id: 'angkor', name: 'Angkor Wat & Siem Reap', region: 'Cambodia', emoji: '🛕', climate: 'tropical',
    about: 'Iconic temple complex; cool-dry season Nov–Feb is most comfortable for temple-hopping, hot season Mar–May is intense, monsoon Jun–Oct brings dramatic skies but muddy paths.',
    base: { sunbathing:2, swimming:1, diving:1, surfing:1, sailing:2, hiking:4, scenic:7, fishing:2, roadtrip:4, adventure:3, golf:2, stargazing:3, museums:10, architecture:10, festivals:6, finedining:6, streetfood:8, nightlife:5, winetasting:1, spa:5, snowsports:0, cycling:4, shopping:5, birding:5, wildlife:3 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'casual', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['easygoing'], physicalBands: ['easy','moderate'],
    dry: [11,12,1,2], hot: [3,4,5], wet: [6,7,8,9,10], peak: [11,12,1], low: [6,7,8,9], naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'winetasting'],
    monthlyWeather: [
      "dry and pleasant, one of the most comfortable months of the year",
      "dry and warming, still comfortable with low humidity",
      "hot and dry, with temperatures climbing fast",
      "scorching and dry, the hottest month of the year",
      "hot and increasingly humid, as the first monsoon rains arrive",
      "hot and humid, with regular afternoon downpours",
      "hot and humid, still deep in the wet season",
      "hot and humid, with rain a near-daily occurrence",
      "hot and humid, one of the wettest months with muddy temple paths",
      "hot and humid, still within the rainy season though easing",
      "warm and drying out, one of the best months as the dry season begins",
      "warm and dry, comfortable with the cool season settling in"
    ], searchAliases: ['Cambodia', 'Siem Reap'] },
  { id: 'goldentriangle', name: 'Golden Triangle (Delhi–Agra–Jaipur)', region: 'India', emoji: '🕌', climate: 'desert',
    about: 'Taj Mahal, forts and palaces; Oct–Mar is comfortably cool and the classic touring season, summer (Apr–Jun) is extremely hot, monsoon (Jul–Sep) is humid with heavy rain.',
    base: { sunbathing:2, swimming:1, diving:1, surfing:1, sailing:1, hiking:2, scenic:5, fishing:1, roadtrip:5, adventure:2, golf:3, stargazing:3, museums:10, architecture:10, festivals:5, finedining:8, streetfood:9, nightlife:5, winetasting:2, spa:6, snowsports:0, cycling:2, shopping:9, birding:6, wildlife:3 },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [10,11,12,1,2,3], hot: [4,5,6], wet: [7,8,9], peak: [11,12,1,2], low: [7,8], sliderEvents: { festivals: [
      { label: 'Diwali season', weight: 4, months: { 10: 0.6, 11: 0.6 } },
    ] }, naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'sailing'],
    monthlyWeather: [
      "cold, especially at night, with dense morning fog common in Delhi",
      "mild and dry, warming up with the coolest fog now clearing",
      "warming fast, dry with pleasant days before the heat builds",
      "hot and dry, with temperatures climbing steadily",
      "scorching and dry, one of the hottest months with highs near 45°C",
      "extremely hot, with dry heat before the monsoon arrives",
      "hot and humid, with the monsoon bringing heavy rain and relief from the heat",
      "hot and humid, still within the monsoon with regular downpours",
      "hot and humid, with rain gradually easing as the month progresses",
      "warm and drying out, one of the best months as the monsoon retreats",
      "mild and dry, comfortable with the classic touring season beginning",
      "cold, especially at night, with dense fog common in the mornings"
    ], searchAliases: ['Delhi', 'Agra', 'Jaipur', 'Taj Mahal', 'India'] },
  { id: 'beijing', name: 'Beijing & Great Wall', region: 'China', emoji: '🏯', climate: 'temperate',
    about: 'Imperial history; spring and fall are mild and clearest (best Great Wall visibility), summer is hot, humid and hazy, winter is cold and dry.',
    base: { sunbathing:2, swimming:1, diving:1, surfing:1, sailing:1, hiking:6, scenic:7, fishing:2, roadtrip:5, adventure:3, golf:3, stargazing:2, museums:10, architecture:10, festivals:7, finedining:8, streetfood:9, nightlife:6, winetasting:2, spa:5, snowsports:3, cycling:5, shopping:7, birding:4, wildlife:2 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' }, scenic: { mountains: 'strong', forests: 'none', coastlines: 'none', deserts: 'none', astrophotography: 'none' } },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate','active'],
    dry: [4,5,9,10], hot: [7,8], cold: [12,1,2], peak: [5,10], low: [1,2,7,8], naSliders: ['swimming', 'surfing', 'diving', 'sailing'],
    monthlyWeather: [
      "cold and dry, the coldest month with crisp air and occasional snow",
      "cold and dry, still firmly in winter though days are lengthening",
      "cool and dry, with spring arriving unevenly and dust winds possible",
      "mild and increasingly pleasant, one of the best months for sightseeing",
      "mild and sunny, still comfortable before the summer heat builds",
      "warm and increasingly humid, with the wet season approaching",
      "hot and humid, the wettest month with heavy rainfall",
      "hot and humid, still deep in the rainy season",
      "warm and drying out, one of the best months with clear skies",
      "mild and crisp, the single best month with clear blue skies",
      "cool and dry, with winter approaching fast",
      "cold and dry, with winter fully settled in"
    ], searchAliases: ['China', 'Great Wall', 'Forbidden City'] },
  { id: 'luangprabang', name: 'Luang Prabang', region: 'Laos', emoji: '🛕', climate: 'tropical',
    about: 'Riverside temple town; cool-dry season Nov–Feb is most pleasant, hot season Mar–May is intense, monsoon Jun–Oct brings frequent rain.',
    base: { sunbathing:2, swimming:2, diving:1, surfing:1, sailing:3, hiking:4, scenic:7, fishing:3, roadtrip:5, adventure:3, golf:1, stargazing:4, museums:9, architecture:9, festivals:6, finedining:6, streetfood:8, nightlife:4, winetasting:1, spa:6, snowsports:0, cycling:4, shopping:4, birding:5, wildlife:3 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'casual', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate'],
    dry: [11,12,1,2], hot: [3,4,5], wet: [6,7,8,9,10], peak: [11,12,1], peakIntensity: 'mild', low: [6,7,8,9], naSliders: ['snowsports', 'surfing', 'diving', 'winetasting'],
    monthlyWeather: [
      "cool and dry, one of the most pleasant months of the year",
      "dry and warming, still comfortable with little rain",
      "hot and dry, with temperatures climbing fast",
      "scorching and dry, the hottest month of the year",
      "hot and increasingly humid, as the first rains of the wet season arrive",
      "hot and humid, with regular afternoon downpours",
      "hot and humid, still deep in the wet season",
      "hot and humid, the wettest month with frequent heavy rain",
      "hot and humid, still within the rainy season though easing",
      "warm and drying out, one of the best months as the dry season begins",
      "warm and dry, comfortable with the cool season settling in",
      "cool and dry, one of the most pleasant months of the year"
    ], searchAliases: ['Laos'] },
  { id: 'bagan', name: 'Bagan', region: 'Myanmar', emoji: '🎈', climate: 'tropical',
    about: 'Thousands of ancient temples across a plain; cool-dry season Nov–Feb is best (and prime for sunrise balloon rides), hot Mar–May, monsoon Jun–Oct.',
    base: { sunbathing:2, swimming:1, diving:1, surfing:1, sailing:2, hiking:3, scenic:6, fishing:2, roadtrip:4, adventure:3, golf:1, stargazing:5, museums:10, architecture:10, festivals:6, finedining:5, streetfood:5, nightlife:2, winetasting:1, spa:4, snowsports:0, cycling:5, shopping:4, birding:5, wildlife:2 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'casual', mountainBiking: 'none' }, scenic: { deserts: 'casual', mountains: 'none', forests: 'none', coastlines: 'none', astrophotography: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate'],
    dry: [11,12,1,2], hot: [3,4,5], wet: [6,7,8,9,10], peak: [11,12,1], low: [6,7,8,9], sliderEvents: { scenic: [
      { label: 'Cool-dry-season clarity', weight: 3, months: { 1: 1, 2: 0.7, 11: 0.7, 12: 1 } },
    ] }, specialSeasons: [{ months: [11,12,1,2], text: "Calm, dry conditions make this the best window for sunrise hot-air balloon flights over the temple plain." }], naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'winetasting'],
    monthlyWeather: [
      "dry and pleasant, one of the coolest, most comfortable months",
      "dry and warming, the driest month with clear skies for sunrise balloon rides",
      "hot and dry, with temperatures climbing fast",
      "scorching and dry, one of the hottest months of the year",
      "the hottest month, dry with intense midday heat",
      "hot and increasingly wet, as the monsoon rains arrive",
      "hot and humid, with regular rain showers",
      "hot and humid, still within the wet season with high humidity",
      "hot and rainy, the wettest month with frequent downpours",
      "hot and humid, still within the rainy season though easing",
      "warm and drying out, one of the best months as the cool season begins",
      "cool and dry, comfortable with clear skies for temple views"
    ], searchAliases: ['Myanmar', 'Burma'] },
);
RAW_DESTINATIONS.push(
  { id: 'uzbekistan', name: 'Samarkand & Bukhara', region: 'Uzbekistan', emoji: '🕌', climate: 'desert',
    about: 'Silk Road architecture; spring and fall are mild and ideal, summer desert heat is intense, winter is cold.',
    base: { sunbathing:2, swimming:1, diving:1, surfing:1, sailing:1, hiking:3, scenic:5, fishing:1, roadtrip:5, adventure:2, golf:1, stargazing:5, museums:9, architecture:9, festivals:5, finedining:6, streetfood:6, nightlife:3, winetasting:3, spa:4, snowsports:0, cycling:3, shopping:7, birding:4, wildlife:2 },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate'],
    dry: [4,5,9,10], hot: [6,7,8], cold: [12,1,2], peak: [4,5,9,10], peakIntensity: 'mild', low: [12,1,2], naSliders: ['swimming', 'surfing', 'diving', 'sailing'],
    monthlyWeather: [
      "cold, with occasional snow and the year's most precipitation",
      "cold, still chilly though days are lengthening",
      "mild and increasingly wet, one of the wetter months before spring settles in",
      "mild and pleasant, one of the best months for sightseeing",
      "warm and dry, still comfortable before the summer heat builds",
      "hot and dry, with little rain and intense midday sun",
      "scorching and dry, one of the hottest, driest months of the year",
      "scorching and dry, still intensely hot with clear skies",
      "warm and dry, with the heat beginning to ease",
      "mild and dry, one of the best months with pleasant, clear days",
      "cool and increasingly damp, as autumn gives way to winter",
      "cold, with winter settling in and occasional snow"
    ], searchAliases: ['Samarkand', 'Bukhara', 'Silk Road'] },
  { id: 'jerusalem', name: 'Jerusalem', region: 'Israel', emoji: '✡️', climate: 'mediterranean',
    about: 'Layered religious history; spring and fall are mild and ideal for walking the old city, summer is hot and dry, winter can bring rare snow and rain.',
    base: { sunbathing:3, swimming:2, diving:2, surfing:2, sailing:2, hiking:5, scenic:5, fishing:1, roadtrip:4, adventure:3, golf:1, stargazing:3, museums:10, architecture:10, festivals:7, finedining:7, streetfood:8, nightlife:5, winetasting:4, spa:4, snowsports:0, cycling:2, shopping:6, birding:5, wildlife:2 },
    budgetBands: ['basic','comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [4,5,9,10], hot: [7,8], wet: [12,1,2], peak: [4,9,10], low: [1,2], naSliders: ['snowsports'],
    monthlyWeather: [
      "mild but rainy, the wettest month of the year",
      "mild and still fairly wet, though drier stretches become more common",
      "mild and increasingly dry, with spring warmth building",
      "mild and pleasant, one of the best months for walking the Old City",
      "warm and mostly dry, still comfortable before summer heat sets in",
      "hot and dry, with little to no rain",
      "hot and dry, one of the driest months of the year",
      "hot and dry, still intensely warm with clear skies",
      "warm and dry, with the heat beginning to ease",
      "mild and pleasant, one of the best months as rain returns gradually",
      "mild and increasingly wet, with the rainy season beginning",
      "mild but rainy, with occasional rare snow possible"
    ], searchAliases: ['Israel', 'Old City'] },
  { id: 'atacama', name: 'Atacama Desert', region: 'Chile', emoji: '🌌', climate: 'desert',
    about: 'The driest desert on Earth and some of the world’s clearest night skies; days are pleasant most of the year, nights are cold, and the brief "Bolivian winter" (Jan–Feb) can bring rare storms.',
    base: { sunbathing:5, swimming:1, diving:1, surfing:1, sailing:1, hiking:8, scenic:10, fishing:2, roadtrip:8, adventure:6, golf:1, stargazing:10, museums:3, architecture:2, festivals:2, finedining:5, streetfood:4, nightlife:2, winetasting:3, spa:4, snowsports:2, cycling:3, shopping:3, birding:6, wildlife:5 },
    activityStyleTiers: { scenic: { deserts: 'signature', astrophotography: 'signature', mountains: 'casual', forests: 'none', coastlines: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded'], physicalBands: ['moderate','active','challenging'],
    dry: [3,4,5,6,7,8,9,10,11], wet: [1,2], cold: [6,7], peak: [7,12,1], peakIntensity: 'mild', low: [4,5], naSliders: ['swimming', 'surfing', 'diving', 'sailing'],
    monthlyWeather: [
      "warm by day and mild at night, with a small chance of rare summer storms",
      "warm by day and mild at night, still within the brief \"Bolivian winter\" storm window",
      "warm and dry, with clear skies returning as the storm risk fades",
      "mild and dry, one of the best shoulder months with clear skies",
      "mild by day but cold at night, dry with excellent visibility",
      "cool by day and cold at night, with some of the clearest stargazing skies of the year",
      "cool by day and cold at night, among the best months for stargazing",
      "cool by day and cold at night, still excellent for clear night skies",
      "mild by day but cold at night, dry with good visibility",
      "mild and dry, one of the best shoulder months with clear skies",
      "warm by day and mild at night, dry with excellent conditions",
      "warm by day and mild at night, dry with clear summer skies"
    ], searchAliases: ['San Pedro de Atacama', 'Chile'] },
  { id: 'uyuni', name: 'Salar de Uyuni', region: 'Bolivia', emoji: '🏜️', climate: 'desert',
    about: 'The world’s largest salt flat. Dry season (May–Oct) gives the cracked white salt crust for classic photos; wet season (Dec–Apr) floods it into a mirror — different look, both stunning.',
    base: { sunbathing:3, swimming:1, diving:1, surfing:1, sailing:1, hiking:6, scenic:10, fishing:1, roadtrip:8, adventure:5, golf:1, stargazing:9, museums:2, architecture:1, festivals:1, finedining:3, streetfood:2, nightlife:1, winetasting:1, spa:2, snowsports:0, cycling:1, shopping:2, birding:5, wildlife:5 },
    activityStyleTiers: { scenic: { deserts: 'signature', astrophotography: 'strong', mountains: 'none', forests: 'none', coastlines: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['secluded'], physicalBands: ['moderate','active','challenging'],
    dry: [5,6,7,8,9,10], wet: [12,1,2,3], cold: [6,7], peak: [7,8,9], peakIntensity: 'mild', low: [2,3],
    birdingPeak: [12,1,2,3], sliderCaps: { birding: 7 }, specialSeasons: [{ months: [5,6,7,8,9,10], text: "The salt flat is a dry, cracked white crust — the classic Salar de Uyuni photo." }, { months: [12,1,2,3], text: "A thin layer of water turns the salt flat into a vast mirror, reflecting the sky." }], naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'sailing', 'architecture', 'festivals', 'nightlife', 'winetasting'],
    monthlyWeather: [
      "mild by day, with rain creating the mirror effect across the salt flat",
      "mild by day, still within the wettest stretch with the mirror effect at its best",
      "mild by day, with rain beginning to ease as the wet season winds down",
      "mild by day but increasingly cold at night, drying out fast",
      "dry, with cold nights often dropping well below freezing",
      "dry, with bitterly cold nights and the classic cracked white salt crust",
      "dry, among the coldest months with nights regularly below -10°C",
      "dry, still bitterly cold at night with clear, crisp days",
      "dry and mild by day, one of the best months with dry, photogenic salt flats",
      "dry and mild, still excellent conditions before the rains return",
      "warming up, with the first rains of the wet season arriving",
      "mild, with rain building toward the mirror-effect season"
    ], searchAliases: ['Bolivia', 'salt flats'] },
  { id: 'yosemite', name: 'Yosemite National Park', region: 'USA', emoji: '🌲', climate: 'temperate',
    about: 'Waterfalls are most powerful during spring snowmelt (Apr–Jun); summer (Jun–Sep) has full trail and road access, Tioga Pass closes with snow roughly Nov–May.',
    base: { sunbathing:3, swimming:3, diving:1, surfing:1, sailing:2, hiking:4, scenic:6, fishing:5, roadtrip:7, adventure:7, golf:1, stargazing:7, museums:2, architecture:1, festivals:1, finedining:3, streetfood:2, nightlife:1, winetasting:2, spa:2, snowsports:4, cycling:4, shopping:2, birding:5, wildlife:4 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'casual', gravelRiding: 'none', mountainBiking: 'none' }, scenic: { mountains: 'signature', forests: 'signature', coastlines: 'none', deserts: 'none', astrophotography: 'strong' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate','active','challenging'],
    dry: [5,6,7,8,9,10], wet: [11,12,1,2,3,4], hot: [7,8,9], cold: [12,1,2], peak: [6,7,8], peakIntensity: 'extreme', low: [11,12,1,2],
    hikingBest: [6,7,8,9], hikingWorst: [12,1,2,3], wildlifePeak: [4,5,9,10], sliderCaps: { wildlife: 5 }, sliderEvents: { hiking: [
      { label: 'High-country trail & road access', weight: 5, months: { 6: 0.85, 7: 1, 8: 1, 9: 0.7 } },
    ], scenic: [
      { label: 'Peak waterfall snowmelt', weight: 3.5, months: { 4: 0.6, 5: 1, 6: 0.7 } },
    ] }, specialSeasons: [{ months: [4,5,6], text: "Waterfalls are at their most powerful, fed by spring snowmelt." }], naSliders: ['surfing', 'diving', 'sailing', 'museums', 'architecture', 'festivals', 'nightlife'],
    searchAliases: ['California', 'Half Dome', 'El Capitan', 'Yosemite Valley'],
    monthlyWeather: [
      "cold, with the valley floor often near freezing overnight",
      "cold, with lingering snow on the valley floor",
      "still chilly at night, but daytime highs climb into the 50s",
      "mild by day, cool at night, and reliably dry",
      "warm, sunny, and one of the most pleasant stretches of the year",
      "warm and dry, with rain now a rare event",
      "hot on the valley floor, often into the 90s",
      "the hottest, driest month of the year",
      "still hot by day, but nights cool off noticeably",
      "mild and dry, with a real chill returning after dark",
      "cooling fast, with the season's first snow often arriving",
      "cold and often snowy, with valley floor lows below freezing"
    ] },
  { id: 'fjords', name: 'Norwegian Fjords', region: 'Norway', emoji: '🚢', climate: 'polar',
    about: 'Dramatic cruise-ship scenery; summer (Jun–Aug) has midnight sun and full-service ports, winter brings snow-capped drama and aurora chances but many cruises pause.',
    base: { sunbathing:1, swimming:1, diving:2, surfing:2, sailing:8, hiking:4, scenic:8, fishing:6, roadtrip:8, adventure:5, golf:1, stargazing:3, museums:3, architecture:4, festivals:3, finedining:5, streetfood:2, nightlife:2, winetasting:1, spa:4, snowsports:4, cycling:3, shopping:3, birding:5, wildlife:5 },
    activityStyleTiers: { scenic: { mountains: 'signature', coastlines: 'signature', astrophotography: 'casual', deserts: 'none', forests: 'casual' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded','easygoing'], physicalBands: ['moderate','active'],
    dry: [6,7,8], cold: [11,12,1,2,3], peak: [6,7], low: [11,2],
    hikingBest: [6,7,8], hikingWorst: [11,12,1,2,3], sliderEvents: { hiking: [
      { label: 'Midnight sun trail access', weight: 4, months: { 6: 0.85, 7: 1, 8: 0.85 } },
    ], scenic: [
      { label: 'Midnight sun full-service season', weight: 1.5, months: { 6: 0.5, 7: 0.85, 8: 0.5 } },
    ], stargazing: [
      { label: 'Winter darkness (limited cruise access)', weight: 5, months: { 1: 1, 2: 0.7, 3: 0.3, 10: 0.3, 11: 0.7, 12: 1 } },
    ] }, specialSeasons: [{ months: [6,7,8], text: "The midnight sun keeps the fjords lit around the clock." }, { months: [11,12,1,2,3], text: "Long polar nights bring aurora chances, though many cruise lines pause winter sailings." }], naSliders: ['swimming', 'winetasting'],
    monthlyWeather: [
      "cold and dark, with short days and aurora chances on clear nights",
      "cold and dark, still deep winter with occasional snow-capped drama",
      "cold, with daylight lengthening fast as winter loosens its grip",
      "cool, with fruit blossoms beginning in the sheltered fjord valleys",
      "mild and increasingly bright, with blossoms in full bloom",
      "mild, with the midnight sun and long, light-filled days beginning",
      "mild and pleasant, the warmest month with nearly round-the-clock daylight",
      "mild, still warm with the midnight sun beginning to fade",
      "cool and crisp, with fewer crowds and good wildlife-watching",
      "cool and increasingly wet, as autumn storms return",
      "cold and dark, with many cruise services pausing for the season",
      "cold and dark, with snow-capped peaks and aurora chances on clear nights"
    ], searchAliases: ['Norway', 'Bergen', 'Geirangerfjord'] },
  { id: 'tasmania', name: 'Tasmania', region: 'Australia', emoji: '🌲', climate: 'temperate',
    about: 'Wild, mountainous, and cool — Cradle Mountain and the Overland Track are the wilderness highlight, Hobart brings food, wine, and MONA. Southern Hemisphere summer (Dec–Feb) is warmest and best for hiking, winter (Jun–Aug) is cold, wet, and often snowy in the highlands.',
    base: { sunbathing:4, swimming:4, diving:4, surfing:3, sailing:5, hiking:5, scenic:7, fishing:6, roadtrip:6, adventure:6, golf:4, stargazing:6, museums:6, architecture:3, festivals:5, finedining:7, streetfood:5, nightlife:4, winetasting:7, spa:4, snowsports:2, cycling:5, shopping:4, birding:6, wildlife:5 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'strong', gravelRiding: 'casual', mountainBiking: 'casual' }, scenic: { forests: 'signature', coastlines: 'strong', mountains: 'strong', deserts: 'none', astrophotography: 'casual' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate','active'],
    dry: [12,1,2,3,4], wet: [6,7,8], cold: [6,7], peak: [12,1,2], low: [6,7],
    wildlifePeak: [9,10,11,12], sliderCaps: { wildlife: 7 },
    sliderEvents: { hiking: [
      { label: 'Summer highland trail access', weight: 4, months: { 1: 1, 2: 1, 3: 0.6, 4: 0.3, 12: 0.7 } },
    ], scenic: [
      { label: 'Summer clarity', weight: 2, months: { 1: 0.85, 2: 0.85, 3: 0.4, 12: 0.5 } },
    ] }, monthlyWeather: [
      "warm and mostly dry, the hottest month and prime for beaches and hiking",
      "warm and dry, still one of the best months for outdoor activities",
      "mild and pleasant, with summer easing into a comfortable autumn",
      "mild, one of the best months as crowds thin and weather stays settled",
      "cool and increasingly wet, with winter approaching",
      "cold and wet, deep in a cool, damp winter",
      "cold and wet, one of the coldest, wettest months of the year",
      "cold and wet, still firmly in winter's grip",
      "cool and unsettled, with spring bringing waterfalls to their fullest",
      "cool and breezy, with spring color and unpredictable weather",
      "mild and increasingly pleasant, as summer builds",
      "warm and drying out, with summer beginning in earnest"
    ], searchAliases: ['Australia', 'Hobart', 'Cradle Mountain', 'Launceston'] },
  { id: 'uluru', name: 'Uluru & the Outback', region: 'Australia', emoji: '🪨', climate: 'desert',
    about: 'The Red Centre; May–Sep (Southern winter) is cool enough to comfortably walk, Nov–Mar summer heat is extreme (regularly 40°C+).',
    base: { sunbathing:6, swimming:1, diving:1, surfing:1, sailing:1, hiking:7, scenic:7, fishing:1, roadtrip:9, adventure:5, golf:1, stargazing:9, museums:3, architecture:2, festivals:3, finedining:4, streetfood:3, nightlife:1, winetasting:2, spa:3, snowsports:0, cycling:2, shopping:3, birding:5, wildlife:5 },
    activityStyleTiers: { scenic: { deserts: 'signature', mountains: 'casual', coastlines: 'none', forests: 'none', astrophotography: 'strong' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded'], physicalBands: ['moderate','active','challenging'],
    dry: [5,6,7,8,9], hot: [11,12,1,2,3], peak: [6,7,8], low: [12,1,2],
    hikingBest: [5,6,7,8,9], hikingWorst: [11,12,1,2,3], sliderEvents: { scenic: [
      { label: 'Cool-season clarity', weight: 2.5, months: { 5: 0.6, 6: 0.85, 7: 1, 8: 0.85, 9: 0.6 } },
    ] }, naSliders: ['snowsports', 'swimming', 'surfing', 'diving', 'sailing', 'nightlife'],
    monthlyWeather: [
      "scorching, the hottest month with highs regularly near 40°C",
      "scorching, still intensely hot with occasional summer storms",
      "hot and dry, with the worst of the heat beginning to ease",
      "warm and dry, one of the best months with comfortable days and cool nights",
      "mild and dry, pleasant for walking with cool nights",
      "cool and dry, comfortable days with cold desert nights",
      "cool and dry, the coldest month with near-freezing nights",
      "mild and dry, still comfortable with cold nights",
      "warm and dry, one of the best months before the heat returns",
      "hot and dry, with temperatures climbing back up",
      "hot and dry, with the summer heat building fast",
      "scorching, with extreme heat setting in for the summer"
    ], searchAliases: ['Ayers Rock', 'Northern Territory', 'Australia', 'Red Centre'] },
  { id: 'tuscany', name: 'Tuscany', region: 'Italy', emoji: '🍇', climate: 'mediterranean',
    about: 'Rolling vineyards and hill towns; spring and fall are classic (harvest in Sep–Oct, wildflowers in spring), summer is hot, dry and busiest.',
    base: { sunbathing:5, swimming:3, diving:1, surfing:1, sailing:3, hiking:7, scenic:6, fishing:2, roadtrip:8, adventure:3, golf:5, stargazing:3, museums:9, architecture:9, festivals:4, finedining:9, streetfood:6, nightlife:4, winetasting:10, spa:5, snowsports:0, cycling:7, shopping:6, birding:4, wildlife:3 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'signature', gravelRiding: 'strong', mountainBiking: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate','active'],
    dry: [5,6,9,10], wet: [11,12,1], hot: [7,8], peak: [6,7,8], low: [11,1,2],
    hikingBest: [4,5,9,10], hikingWorst: [7,8], sliderEvents: { scenic: [
      { label: 'Wildflower bloom & harvest color', weight: 3, months: { 4: 0.7, 5: 1, 9: 1, 10: 0.85 } },
    ], festivals: [
      { label: 'Harvest sagre (food & wine festivals)', weight: 4, months: { 9: 0.8, 10: 1 } },
    ] }, specialSeasons: [{ months: [9,10], text: "Grape and olive harvest is underway across the countryside, the most atmospheric time to visit wine country." }, { months: [5], text: "Wildflowers and poppies carpet the countryside in spring bloom." }], naSliders: ['snowsports', 'surfing', 'diving'],
    monthlyWeather: [
      "cold, one of the coolest, quietest months with occasional rain",
      "cold and still quiet, with winter beginning to loosen its grip",
      "cool and often rainy, with spring arriving unevenly",
      "mild and increasingly pleasant, with wildflowers and green hills",
      "warm and pleasant, one of the best months before summer crowds",
      "warm and sunny, with long, comfortable days",
      "hot, dry, and sunny, one of the driest, busiest months",
      "hot and dry, still intensely sunny with peak summer crowds",
      "warm and pleasant, one of the best months as harvest season begins",
      "mild and pleasant, still excellent with harvest season in full swing",
      "cool and rainy, the wettest month of the year",
      "cold, with winter settling in and quieter hill towns"
    ], searchAliases: ['Florence', 'Siena', 'Chianti', 'Italy'] },
  { id: 'provence', name: 'Provence', region: 'France', emoji: '💜', climate: 'mediterranean',
    about: 'Lavender fields (peak bloom roughly late June–early August) and hill villages; late spring and early fall offer mild, fragrant, less crowded touring.',
    base: { sunbathing:6, swimming:4, diving:2, surfing:2, sailing:5, hiking:7, scenic:6, fishing:2, roadtrip:8, adventure:3, golf:4, stargazing:3, museums:7, architecture:8, festivals:6, finedining:9, streetfood:6, nightlife:4, winetasting:9, spa:5, snowsports:0, cycling:7, shopping:6, birding:4, wildlife:3 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'signature', gravelRiding: 'casual', mountainBiking: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['secluded','easygoing'], physicalBands: ['easy','moderate','active'],
    dry: [5,6,7,8,9], wet: [11,12,1], peak: [7,8], low: [11,1,2], sliderEvents: { scenic: [
      { label: 'Lavender bloom', weight: 3.5, months: { 6: 0.85, 7: 1, 8: 0.85 } },
    ] }, specialSeasons: [{ months: [6,7,8], text: "Lavender fields are in peak bloom across the Luberon and Valensole plateau." }], naSliders: ['snowsports'],
    monthlyWeather: [
      "cold, with the mistral wind a frequent feature of winter",
      "cold and often windy, still one of the quieter, cooler months",
      "cool and breezy, with spring warmth beginning to build",
      "mild and increasingly pleasant, one of the best months before crowds arrive",
      "warm and sunny, still comfortable before peak summer heat",
      "warm and sunny, with lavender fields beginning to bloom",
      "hot and dry, with lavender fields at their peak in the first half of the month",
      "hot and dry, still intensely sunny with peak summer crowds",
      "warm and pleasant, one of the best months as crowds and heat ease",
      "mild and pleasant, still comfortable with fewer visitors",
      "cool and increasingly wet, with the mistral wind returning",
      "cold, with the mistral wind a frequent winter feature"
    ], searchAliases: ['Aix-en-Provence', 'Avignon', 'lavender', 'France'] },
  { id: 'napa', name: 'Napa Valley', region: 'California, USA', emoji: '🍷', climate: 'mediterranean',
    about: 'Wine country; harvest season (Aug–Oct) is the most atmospheric — and busiest, priciest — spring brings mustard-flower blooms between the vines, winter is quiet and rainy.',
    base: { sunbathing:5, swimming:1, diving:1, surfing:1, sailing:2, hiking:5, scenic:6, fishing:2, roadtrip:6, adventure:2, golf:6, stargazing:3, museums:3, architecture:3, festivals:4, finedining:9, streetfood:4, nightlife:4, winetasting:10, spa:6, snowsports:0, cycling:5, shopping:6, birding:3, wildlife:2 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'strong', gravelRiding: 'casual', mountainBiking: 'none' } },
    budgetBands: ['comfortable','highend','luxury'], vibeBands: ['easygoing','lively'], physicalBands: ['easy','moderate'],
    dry: [5,6,7,8,9,10], wet: [11,12,1,2], peak: [8,9,10], low: [12,1,2], sliderEvents: { festivals: [
      { label: 'Crush season harvest festivals', weight: 4, months: { 8: 0.6, 9: 1, 10: 0.85 } },
    ] }, specialSeasons: [{ months: [8,9,10], text: "Grape harvest (crush season) is underway, the most atmospheric and bustling time in wine country." }, { months: [2], text: "Wild mustard flowers bloom bright yellow between the vine rows." }], naSliders: ['snowsports', 'swimming', 'surfing', 'diving'],
    monthlyWeather: [
      "cool and rainy, the wettest month of the year",
      "cool and still rainy, with the wet season continuing",
      "mild and still fairly wet, with rain beginning to taper off",
      "mild and increasingly dry, one of the best months with mustard flowers blooming between the vines",
      "warm and mostly dry, still comfortable before summer heat builds",
      "warm and dry, with the dry season settling in",
      "hot and dry, still comfortable with cool evenings",
      "hot and dry, still deep in the dry season",
      "warm and dry, with harvest season beginning",
      "warm and dry, the heart of harvest season and the most atmospheric month",
      "cool, with the first rains of the season returning",
      "cool and rainy, quiet with the wet season back in full swing"
    ], searchAliases: ['California', 'wine country'] },
  { id: 'mendoza', name: 'Mendoza', region: 'Argentina', emoji: '🍷', climate: 'mediterranean',
    about: 'Malbec country at the foot of the Andes; harvest season (Feb–Apr) is festive and scenic, summer (Dec–Feb) is hot, winter (Jun–Aug) brings snow to the nearby mountains.',
    base: { sunbathing:4, swimming:1, diving:1, surfing:1, sailing:1, hiking:6, scenic:7, fishing:2, roadtrip:6, adventure:4, golf:3, stargazing:5, museums:3, architecture:3, festivals:5, finedining:9, streetfood:5, nightlife:4, winetasting:10, spa:4, snowsports:3, cycling:5, shopping:4, birding:4, wildlife:3 },
    activityStyleTiers: { cycling: { scenicRoadCycling: 'strong', gravelRiding: 'casual', mountainBiking: 'none' } },
    budgetBands: ['basic','comfortable','highend'], vibeBands: ['easygoing'], physicalBands: ['easy','moderate','active'],
    dry: [2,3,4,9,10,11], hot: [12,1], cold: [7], peak: [2,3,4], peakIntensity: 'mild', low: [6,7], sliderEvents: { festivals: [
      { label: 'Vendimia (grape harvest festival)', weight: 4, months: { 2: 0.6, 3: 1, 4: 0.5 } },
    ] }, specialSeasons: [{ months: [2,3,4], text: "Grape harvest (vendimia) is underway, celebrated with a major wine festival in early March." }], naSliders: ['swimming', 'surfing', 'diving', 'sailing'],
    monthlyWeather: [
      "hot and mostly dry, with clear skies and warm evenings",
      "hot and dry, still deep in summer with harvest season approaching",
      "warm and pleasant, with the grape harvest getting underway",
      "mild and pleasant, still within harvest season with vineyards turning gold",
      "cool and mild, with autumn colors settling over the vineyards",
      "cool, with the first snow dusting the nearby Andes",
      "cold, the coolest month with occasional frost though rarely snow in the city",
      "cold, still within winter with the mountains capped in snow",
      "mild and increasingly pleasant, as spring begins to warm things up",
      "mild and pleasant, one of the best months with vineyards in bloom",
      "warm and pleasant, still comfortable before summer heat builds",
      "hot and mostly dry, with summer heat settling in"
    ], searchAliases: ['Argentina', 'Malbec', 'Andes'] },
);

const DESTINATIONS = RAW_DESTINATIONS.map(d => {
  const { monthly, badges, weatherBand } = deriveDestinationScores(d);
  return { ...d, monthly, badges, weatherBand };
});

// Added for the Next.js rewrite's migration/validation scripts — the file
// above this line is an unmodified copy of the legacy vanilla-JS app's
// data.js, kept as the auditable source of truth for the one-time content
// migration into Postgres (see scripts/migrate-legacy-data.ts) and as the
// reference implementation validate-migration.ts diffs the ported
// TypeScript scoring functions against.
export { RAW_DESTINATIONS, DESTINATIONS, SLIDERS, PERSONAS, BAND_DIMENSIONS, deriveDestinationScores, generateMonthlyBlurb, allBandsSelected };
