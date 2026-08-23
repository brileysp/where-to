/* ---------------------------------------------------------------------
   Where To? — Swipe-deck interest picker
   -----------------------------------------------------------------
   The lightweight "pick a few things you like the look of" step shown
   before swiping starts (Step 1). Two jobs:

     1. Tier-gate which card categories are even eligible to appear in
        the swipe deck. Directly picked emojis fully unlock their
        categories; categories NOT covered by any emoji here (Food,
        Cities, Theme Parks & Resorts, etc. — mainstream enough that
        nearly everyone has some baseline interest) stay always-eligible.
        Categories covered by an UNPICKED emoji are gated: 'correlated'
        ones (see correlates below) get elevated trickle odds, everything
        else gets the same rare baseline trickle already used for
        categories the user has actively rejected via swiping. See
        categoryInterestTier() and chooseNextCard() in traveldna.js.
        This generalizes, at the CATEGORY level, the same "earn deeper
        content" idea the 4 hierarchical domains already do via swipe
        signal alone (see domains.js) — an explicit pick is just a
        faster way to reach the same trust than swiping proves it.

     2. Seed a crude starting profile from picks — used to lightly bias
        early swipe selection, and (for someone who skips swiping
        entirely) to build destination-slider weights directly from what
        they picked instead of a fixed persona preset. See
        seedProfileFromInterests() below and applyInterestPickWeights()
        in app.js.

   Picking nothing at all is never a punishment — categoryInterestTier()
   returns 'unrestricted' (no gating at all) when dnaState.pickedInterests
   is empty, so skipping this step just reverts to "show everything,"
   the same as before this feature existed.
--------------------------------------------------------------------- */

const INTEREST_EMOJIS = [
  { key: 'beach', emoji: '🏖️', label: 'Beach & Sun',
    categories: ['Beach'],
    attributes: ['beach'],
    correlates: [{ key: 'wellness', weight: 0.5 }] },
  { key: 'water', emoji: '🌊', label: 'Water & Ocean',
    categories: ['Ocean Swimming', 'Snorkeling & Diving', 'Surfing', 'Sailing & Yachting'],
    attributes: ['oceanSwimming', 'snorkeling', 'surfing'],
    correlates: [{ key: 'beach', weight: 0.5 }, { key: 'wildlife', weight: 0.4 }] },
  { key: 'wildlife', emoji: '🦁', label: 'Wildlife & Safari',
    categories: ['Wildlife', 'Birding', 'Remote Wilderness'],
    attributes: ['wildlife', 'birding', 'remoteWilderness'],
    correlates: [{ key: 'photography', weight: 0.5 }, { key: 'outdoors', weight: 0.4 }] },
  { key: 'outdoors', emoji: '🏔️', label: 'Outdoors & Adventure',
    categories: ['Hiking', 'Scenic Touring & Rentals', 'Adventure Sports', 'Rustic Adventure'],
    attributes: ['hiking', 'rusticAdventure', 'adrenaline'],
    correlates: [{ key: 'cycling', weight: 0.5 }, { key: 'photography', weight: 0.4 }] },
  { key: 'cycling', emoji: '🚴', label: 'Cycling',
    categories: ['Cycling'],
    attributes: ['cycling'],
    correlates: [{ key: 'outdoors', weight: 0.5 }, { key: 'wine', weight: 0.4 }] },
  { key: 'photography', emoji: '📸', label: 'Photography',
    categories: ['Photography'],
    attributes: ['photography', 'landscapePhotography'],
    correlates: [{ key: 'wildlife', weight: 0.5 }, { key: 'outdoors', weight: 0.4 }] },
  { key: 'wine', emoji: '🍷', label: 'Wine & Drink',
    categories: ['Wine & Spirits'],
    attributes: ['wine'],
    correlates: [{ key: 'culture', weight: 0.4 }, { key: 'nightlife', weight: 0.4 }, { key: 'cycling', weight: 0.3 }] },
  { key: 'culture', emoji: '🏛️', label: 'Culture & History',
    categories: ['Culture'],
    attributes: ['culture', 'authenticity'],
    correlates: [{ key: 'wine', weight: 0.4 }] },
  { key: 'wellness', emoji: '🧘', label: 'Spa & Wellness',
    categories: ['Wellness'],
    attributes: ['wellness', 'relaxation'],
    correlates: [{ key: 'beach', weight: 0.4 }, { key: 'golf', weight: 0.3 }] },
  { key: 'nightlife', emoji: '🍸', label: 'Nightlife',
    categories: ['Nightlife'],
    attributes: ['nightlife'],
    correlates: [{ key: 'wine', weight: 0.4 }] },
  { key: 'golf', emoji: '⛳', label: 'Golf',
    categories: ['Golf'],
    attributes: ['golf'],
    // Explicitly does NOT correlate to Outdoors & Adventure or Rustic
    // Adventure — the golf demographic skews resort/leisure, not
    // backcountry, even though both are nominally "outdoorsy."
    correlates: [{ key: 'beach', weight: 0.4 }, { key: 'cycling', weight: 0.3 }, { key: 'wellness', weight: 0.3 }] },
  { key: 'snow', emoji: '🎿', label: 'Snow Sports',
    categories: ['Snow Sports'],
    attributes: ['snowsports'],
    correlates: [{ key: 'outdoors', weight: 0.4 }, { key: 'wellness', weight: 0.3 }] },
];

function interestByKey(key) {
  return INTEREST_EMOJIS.find(e => e.key === key);
}

/**
 * How eligible a card category is to appear in the swipe deck, given what
 * the user picked in the interest picker. Deliberately NOT a hard
 * eligibility exclude (see isCardEligible in traveldna.js, which stays
 * reserved for genuine mismatches like Family cards for a no-kids
 * traveler) — this only informs SELECTION PROBABILITY in chooseNextCard,
 * so a 'locked' category can still show up occasionally, just rarely.
 */
function categoryInterestTier(category, dnaState) {
  const picked = new Set((dnaState && dnaState.pickedInterests) || []);
  if (!picked.size) return 'unrestricted';
  const covering = INTEREST_EMOJIS.filter(e => e.categories.includes(category));
  if (!covering.length) return 'tier1';
  if (covering.some(e => picked.has(e.key))) return 'unlocked';
  const correlated = covering.some(e => (e.correlates || []).some(c => picked.has(c.key)));
  return correlated ? 'correlated' : 'locked';
}

/**
 * Nudges a Travel DNA profile with a crude starting bias from interest
 * picks — DIRECT PICKS ONLY. Correlation (see correlates on each
 * INTEREST_EMOJIS entry) intentionally never touches the profile or
 * sliders, only which CARDS get a better chance of being shown during
 * swiping (see chooseNextCard in traveldna.js) — the sliders themselves
 * should only ever reflect what the user actually picked plus what they
 * actually swiped on, with no inference layered on top. Deliberately
 * additive onto whatever profile is passed in (not a replacement), and
 * flows through the SAME convertTravelDNAToRecommendationWeights()
 * conversion every other profile uses — "crude" means less evidence
 * behind the numbers, not a parallel system with its own math.
 */
function seedProfileFromInterests(profile, pickedKeys) {
  const updated = { ...profile };
  const picked = new Set(pickedKeys || []);
  const PRIMARY_NUDGE = 8;

  picked.forEach(key => {
    const def = interestByKey(key);
    if (!def) return;
    (def.attributes || []).forEach(attr => {
      if (!(attr in updated)) return;
      updated[attr] = (updated[attr] || 0) + PRIMARY_NUDGE;
    });
  });

  return updated;
}

export { INTEREST_EMOJIS, interestByKey, categoryInterestTier, seedProfileFromInterests };
