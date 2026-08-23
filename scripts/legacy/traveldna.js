/* ---------------------------------------------------------------------
   Where To? — Travel DNA engine
   -----------------------------------------------------------------
   Pure logic for the Travel DNA Builder: the preference model, swipe
   scoring, adaptive card selection, calibration math, trait discovery,
   insight checks, and the conversion from a Travel DNA profile into
   destination-recommendation slider weights.

   No DOM code lives here — see dna-ui.js for rendering, and app.js for
   how the main destination app consumes convertTravelDNAToRecommendationWeights().
--------------------------------------------------------------------- */

// Added for the Next.js rewrite's test harness — the original vanilla-JS
// app loaded these as separate <script> tags sharing global scope; ES
// modules need explicit imports for the same cross-file references.
import { EXPERIENCE_CARDS, CARD_CATEGORIES } from './cards.js';
import { DOMAIN_REGISTRY, cardDomains } from './domains.js';
import { DIMENSIONS, dimensionById } from './dimensions.js';
import { TENSION_LIBRARY, tensionById } from './tensions.js';
import { categoryInterestTier } from './interests.js';
import { allBandsSelected } from './data.js';

// ---- The preference model ---------------------------------------------------
// Every attribute a swipe or insight can move. Scores are unbounded small
// integers (roughly -10..+40 in practice) — NOT already a 0-10 UI scale.
// convertTravelDNAToRecommendationWeights() does that normalization at the
// boundary with the destination app.
const PREFERENCE_ATTRIBUTES = [
  'wildlife', 'birding', 'photography', 'beach', 'oceanSwimming', 'snorkeling',
  'hiking', 'cycling', 'food', 'wine', 'culture', 'cities', 'remoteWilderness',
  'luxury', 'rusticAdventure', 'wellness', 'shopping', 'nightlife', 'family',
  'lowSeasonDeals', 'avoidingCrowds', 'comfortFlexibility', 'uniqueness',
  'physicalChallenge', 'relaxation', 'authenticity', 'famousLandmarks',
  // adrenaline is distinct from physicalChallenge: a grueling multi-day trek
  // is physicalChallenge without much adrenaline, while a jetski or bungee
  // jump is adrenaline without much sustained exertion. Cards can and do
  // signal both at once (e.g. rock climbing), but they're different axes.
  'adrenaline',
  // golf/snowsports: added alongside the interest-picker emojis (see
  // interests.js) — they mirror how 'surfing' was added earlier, so a Golf
  // or Snow Sports pick can flow through the same profile -> slider
  // conversion pipeline (convertTravelDNAToRecommendationWeights) as
  // everything else instead of needing a special case.
  'golf', 'snowsports',
  // fishing: added because it had NONE before — the fishing destination
  // slider was entirely proxied through remoteWilderness/rusticAdventure/
  // relaxation (a leftover from before Fishing had its own card category),
  // which meant loving a remote wilderness or relaxing beach card could
  // inflate "fishing" with zero fishing-specific signal ever involved.
  'fishing',
  // sailing: same audit, same fix — Sailing & Yachting had no dedicated
  // attribute at all, proxied entirely through oceanSwimming/luxury/
  // remoteWilderness/relaxation.
  'sailing',
  // museums/architecture/festivals/fineDining/streetFood: these all used
  // to share ONE attribute each ('culture' or 'food') with their siblings,
  // so loving a museum card and loving a festival card were nearly
  // indistinguishable. Distinct attributes so each slider can actually
  // differentiate.
  'museums', 'architecture', 'festivals', 'fineDining', 'streetFood',
  // listing/viewQualityTolerance (Birding) and comfortAfterEffort/innToInn
  // (Cycling): added for the deep-card rewrite that sharpened all 4
  // priority domains toward testing real nuance — a target-driven lister
  // who'll accept a bad view for a tickable bird is a genuinely different
  // birder than a photography-first one, and "recovery comfort matters"
  // is a different axis than the existing generic 'comfort'.
  'listing', 'viewQualityTolerance', 'comfortAfterEffort', 'innToInn',

  // ---- Hierarchical special-interest subdimensions --------------------------
  // Two new PRIMARY domain attributes (mirroring how 'birding' and 'cycling'
  // already work — a single top-level score for "how much does this domain
  // matter overall"), plus the finer-grained subdimensions each domain's
  // deep cards probe. A subdimension isn't "how much do you like X" — it's
  // "what KIND of X traveler are you." These are all initialized to 0 like
  // everything else; most stay untouched until a user actually gets deep
  // enough into a domain to trigger its unlock (see domains.js).
  'surfing', 'landscapePhotography',

  // Birding subdimensions
  'rareEndemics', 'speciesCount', 'guidedBirding', 'independentBirding',
  'birdingFromHides', 'pelagicBirding', 'owling', 'migrationSpectacle',
  'rainforestBirding', 'wetlandsBirding', 'difficultTargetChasing', 'casualBirding',
  'comfortSacrifice', 'earlyMorningTolerance', 'patience', 'weatherTolerance',
  'intensity', 'specialistGuiding', 'casualTravel', 'rarity',

  // Surfing subdimensions
  'beginnerFriendly', 'reefBreaks', 'warmWater', 'uncrowded', 'surfCamp',
  'luxurySurf', 'longboarding', 'consistentSwell', 'surfPlusCulture',
  'surfPlusNightlife', 'surfPlusWellness', 'remoteSurf', 'travelForConditions',
  'basicLodgingTolerance', 'familyFriendlySurf', 'surfAsMainPurpose',
  'surfAsSideActivity', 'conditionsMatter', 'seriousSurfIntensity',
  'socialTravel', 'solitude', 'surfIntensity',

  // Cycling subdimensions
  'scenicRoadCycling', 'hardClimbing', 'fastDescents', 'gravelRiding',
  'mountainBiking', 'eBikeFriendly', 'bikeTouring', 'cafeToCafe',
  'luxuryInnToInn', 'performanceFocus', 'casualCycling', 'lowTrafficRoads',
  'famousRoutes', 'remoteLandscapes', 'supportVehiclePreference',
  'cyclingAsMainPurpose', 'cyclingAsSideActivity', 'longDayTolerance',
  'nightComfort', 'scenery', 'comfort', 'socialPace', 'riskTolerance',
  'planningComplexity',

  // Landscape Photography subdimensions
  'goldenHour', 'iconicLandscapes', 'obscureLandscapes', 'mountains', 'deserts',
  'coastlines', 'forests', 'waterfalls', 'astrophotography', 'dramaticWeather',
  'gearHeavy', 'photoAsMainPurpose', 'photoAsSideActivity', 'hikingForTheShot',
  'roadTrip', 'droneFriendly', 'lateNightTolerance', 'crowds',
];

function createEmptyPreferenceProfile() {
  const profile = {};
  PREFERENCE_ATTRIBUTES.forEach(attr => (profile[attr] = 0));
  return profile;
}

// ---- Basics: collected once, before swiping starts ---------------------------
// Who the user usually travels with, plus the same 4 "Open To" band
// dimensions the main app uses (BAND_DIMENSIONS, defined in data.js) — asked
// up front so the swipe deck can skip cards that obviously don't fit rather
// than making the user sit through them.
const TRAVEL_COMPANIONS = [
  { key: 'solo', label: 'Solo' },
  { key: 'friends', label: 'With friends' },
  { key: 'partner', label: 'With a spouse or partner' },
  { key: 'kids', label: 'With my kids' },
];

// ---- Swipe scoring ------------------------------------------------------------
// No = the experience is actively unappealing or low priority right now.
// Yes = normal-strength positive signal.
// Love = strong positive signal, amplified.
const SWIPE_WEIGHTS = { no: -1, yes: 1, love: 2.5 };

/**
 * Apply one swipe's preferenceSignals onto a profile and return a NEW profile
 * (does not mutate the input, so callers can diff before/after easily).
 *
 * The tricky part: a card's preferenceSignals can include NEGATIVE numbers
 * for attributes the experience deliberately trades away — e.g. a rustic
 * jungle-lodge card has `luxury: -1` because staying somewhere basic is part
 * of the point, not a flaw. If we naively multiplied every signal by the
 * swipe weight, a Love swipe (2.5x) would turn that -1 into -2.5, which
 * reads as "this user STRONGLY dislikes luxury" — a much stronger claim than
 * the evidence supports. Loving a rustic experience mostly tells us the user
 * is fine trading luxury away for the payoff, not that they're newly averse
 * to luxury in general.
 *
 * So: negative signals are never amplified by the Love multiplier. They're
 * applied at normal (1x) strength regardless of swipe type's magnitude,
 * while positive signals get the full weight (including the 2.5x Love
 * amplification). A "No" swipe still flips negative signals positive at
 * normal strength (rejecting a rustic-coded card is a mild vote FOR
 * luxury/comfort) — that inversion is fine at 1x and doesn't need damping.
 */
function applySwipeToProfile(profile, card, swipeType) {
  const weight = SWIPE_WEIGHTS[swipeType];
  if (weight === undefined) return { ...profile };
  const updated = { ...profile };
  Object.entries(card.preferenceSignals || {}).forEach(([attr, signal]) => {
    if (!(attr in updated)) updated[attr] = 0; // tolerate cards referencing new attrs gracefully
    let delta;
    if (swipeType === 'love' && signal < 0) {
      // Damped: apply at Yes-strength (1x), not the full 2.5x Love multiplier.
      delta = signal * 1;
    } else {
      delta = signal * weight;
    }
    updated[attr] += delta;
  });
  return updated;
}

// ---- Dimension model (dimensions.js) -------------------------------------
// Cards -> signals -> dimensions -> tensions -> insights -> recommendations.
// This is the "where does the user sit between two competing tendencies"
// layer, separate from the attribute profile above. See dimensions.js for
// the DIMENSIONS registry and the architecture note on why it's separate.

/**
 * Raw storage shape: a flat { [poleKey]: number } accumulator across all 20
 * poles, plus a per-dimension list of card ids that have ever touched
 * either of that dimension's two poles (used for confidence + evidence).
 * Deliberately minimal — everything display-shaped (percentages, leading
 * pole, confidence, status, summary text) is DERIVED on demand by
 * calculateDimensionScores(), not stored, so there's only one source of
 * truth to keep in sync.
 */
function createInitialDimensionState() {
  const raw = {};
  DIMENSIONS.forEach(def => { raw[def.keyA] = 0; raw[def.keyB] = 0; });
  const evidenceCardIds = {};
  DIMENSIONS.forEach(def => { evidenceCardIds[def.id] = []; });
  return { raw, evidenceCardIds };
}

/**
 * Applies one swipe's dimensionSignals onto a dimensionState and returns a
 * NEW dimensionState (same immutable-update pattern as applySwipeToProfile).
 * Mirrors applySwipeToProfile's negative-signal damping for the same
 * reason: a card that deliberately trades away one pole (e.g. a solo,
 * self-guided card carrying `expertise: -1`) shouldn't have that trade-away
 * amplified by a 2.5x Love multiplier into "actively hates expertise" — it's
 * only evidence the pole wasn't the point of THIS experience.
 */
function applyDimensionSignalsFromSwipe(dimensionState, card, swipeType) {
  const weight = SWIPE_WEIGHTS[swipeType];
  if (weight === undefined) return { raw: { ...dimensionState.raw }, evidenceCardIds: { ...dimensionState.evidenceCardIds } };
  const raw = { ...dimensionState.raw };
  const evidenceCardIds = { ...dimensionState.evidenceCardIds };
  const signals = card.dimensionSignals || {};

  Object.entries(signals).forEach(([key, signal]) => {
    if (!(key in raw)) raw[key] = 0;
    const delta = (swipeType === 'love' && signal < 0) ? signal * 1 : signal * weight;
    raw[key] += delta;
  });

  DIMENSIONS.forEach(def => {
    if (def.keyA in signals || def.keyB in signals) {
      const existing = evidenceCardIds[def.id] || [];
      if (!existing.includes(card.id)) {
        evidenceCardIds[def.id] = [...existing, card.id];
      }
    }
  });

  return { raw, evidenceCardIds };
}

/**
 * How sure are we about a dimension's leading pole? Two things have to be
 * true for real confidence: enough DISTINCT cards actually tested this
 * dimension (volume), and the split isn't close to a 50/50 coin flip (skew).
 * Either one alone is a weak signal — 2 cards that split 100/0 is still too
 * little evidence, and 10 cards that split 52/48 is real volume but no
 * actual lean. Weighted 60/40 toward volume so a dimension can't read as
 * "confident" purely off one or two extreme swipes.
 */
function calculateDimensionConfidence(evidenceCount, poleAScore) {
  const volumeFactor = Math.min(1, evidenceCount / 8);
  const skewFactor = Math.abs(poleAScore - 50) / 50;
  return Math.round((volumeFactor * 0.6 + skewFactor * 0.4) * 100) / 100;
}

function generateDimensionSummary(def, leadingPole, status) {
  if (status === 'unresolved' || !leadingPole) {
    return `Still building a read on ${def.label.toLowerCase()}.`;
  }
  return leadingPole === def.poleA ? def.summaryA : def.summaryB;
}

/**
 * Derives the full display-ready TravelDNADimension array from raw state.
 * Only the POSITIVE portion of each pole's accumulator counts toward the
 * percentage split — a pole actively pushed negative (real rejection, not
 * just "never came up") pulls that pole's share toward 0 rather than
 * producing a negative percentage, while still counting as real evidence
 * the dimension was tested.
 */
function calculateDimensionScores(dnaState) {
  const state = dnaState.dimensionState || createInitialDimensionState();
  return DIMENSIONS.map(def => {
    const rawA = state.raw[def.keyA] || 0;
    const rawB = state.raw[def.keyB] || 0;
    const displayA = Math.max(0, rawA);
    const displayB = Math.max(0, rawB);
    const total = displayA + displayB;
    const poleAScore = total > 0 ? Math.round((100 * displayA) / total) : 50;
    const poleBScore = 100 - poleAScore;
    const evidenceCardIds = state.evidenceCardIds[def.id] || [];
    const confidence = calculateDimensionConfidence(evidenceCardIds.length, poleAScore);
    const leadingPole = poleAScore === poleBScore ? null : (poleAScore > poleBScore ? def.poleA : def.poleB);
    const status = (confidence >= 0.6 && evidenceCardIds.length >= 4) ? 'strong_signal'
      : (confidence >= 0.35 && evidenceCardIds.length >= 2) ? 'moderate_signal'
      : 'unresolved';
    return {
      id: def.id, label: def.label, poleA: def.poleA, poleB: def.poleB,
      poleAScore, poleBScore, leadingPole, confidence, evidenceCardIds,
      summary: generateDimensionSummary(def, leadingPole, status),
      status,
    };
  });
}

/** Top N resolved dimensions (moderate or strong), most confident first. */
function getStrongestDimensions(dnaState, n = 5) {
  return calculateDimensionScores(dnaState)
    .filter(d => d.status !== 'unresolved')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, n);
}

/** Up to N unresolved dimensions, closest-to-resolving (most evidence) first. */
function getUnresolvedDimensions(dnaState, n = 5) {
  return calculateDimensionScores(dnaState)
    .filter(d => d.status === 'unresolved')
    .sort((a, b) => b.evidenceCardIds.length - a.evidenceCardIds.length)
    .slice(0, n);
}

// ---- Tension model (tensions.js) -----------------------------------------
// Cards -> Signals -> Dimensions -> Tensions -> Insights -> Recommendations.
// A tension identifies two tendencies the user holds AT ONCE that would
// normally trade off against each other. See tensions.js for the
// TENSION_LIBRARY registry and the signal-type documentation.

function pickEvidenceCardIdsForAttributes(dnaState, attrs, n) {
  const seen = new Set();
  const ids = [];
  const swipes = [...(dnaState.swipes || [])].reverse();
  for (const sw of swipes) {
    if (sw.type === 'no') continue;
    const card = EXPERIENCE_CARDS.find(c => c.id === sw.cardId);
    if (!card || seen.has(card.id)) continue;
    if (!attrs.some(a => (card.preferenceSignals || {})[a] > 0)) continue;
    seen.add(card.id);
    ids.push(card.id);
    if (ids.length >= n) break;
  }
  return ids;
}

function pickEvidenceCardIdsForPoles(dnaState, poleKeys, n) {
  const seen = new Set();
  const ids = [];
  const swipes = [...(dnaState.swipes || [])].reverse();
  for (const sw of swipes) {
    if (sw.type === 'no') continue;
    const card = EXPERIENCE_CARDS.find(c => c.id === sw.cardId);
    if (!card || seen.has(card.id)) continue;
    if (!poleKeys.some(k => (card.dimensionSignals || {})[k] > 0)) continue;
    seen.add(card.id);
    ids.push(card.id);
    if (ids.length >= n) break;
  }
  return ids;
}

/** Evidence from positive swipes on cards touching a set of profile attributes. */
function profileSideEvidence(dnaState, attrs, min) {
  const total = attrs.reduce((sum, a) => sum + Math.max(0, (dnaState.profile || {})[a] || 0), 0);
  const supportingCardIds = pickEvidenceCardIdsForAttributes(dnaState, attrs, 6);
  const hasLove = (dnaState.swipes || []).some(sw => sw.type === 'love' && supportingCardIds.includes(sw.cardId));
  return { matches: total >= min, count: supportingCardIds.length, hasLove, supportingCardIds };
}

/** Evidence from positive swipes on cards touching a set of dimension poles. */
function dimensionPoleSideEvidence(dnaState, poleKeys, min) {
  const state = dnaState.dimensionState || createInitialDimensionState();
  const total = poleKeys.reduce((sum, k) => sum + Math.max(0, state.raw[k] || 0), 0);
  const supportingCardIds = pickEvidenceCardIdsForPoles(dnaState, poleKeys, 6);
  const hasLove = (dnaState.swipes || []).some(sw => sw.type === 'love' && supportingCardIds.includes(sw.cardId));
  return { matches: total >= min, count: supportingCardIds.length, hasLove, supportingCardIds };
}

/**
 * Evidence from actual REJECTED (No) swipes on cards that positively touch
 * a set of profile attributes — the "dislikes X" side of a tension where no
 * dedicated attribute exists for the disliked thing itself (e.g. "rejects
 * dense museum touring" has no `dislikesMuseums` attribute; it's read off
 * real No-swipes on museum/landmark-heavy cards instead).
 */
function rejectedAttrsSideEvidence(dnaState, attrs, min) {
  const supportingCardIds = [...new Set(
    (dnaState.swipes || [])
      .filter(sw => sw.type === 'no')
      .map(sw => sw.cardId)
      .filter(cardId => {
        const card = EXPERIENCE_CARDS.find(c => c.id === cardId);
        return card && attrs.some(a => (card.preferenceSignals || {})[a] > 0);
      })
  )].slice(0, 6);
  return { matches: supportingCardIds.length >= min, count: supportingCardIds.length, hasLove: false, supportingCardIds };
}

function evaluateTensionSide(dnaState, side) {
  if (side.type === 'profile') return profileSideEvidence(dnaState, side.keys, side.min);
  if (side.type === 'dimensionPole') return dimensionPoleSideEvidence(dnaState, side.keys, side.min);
  if (side.type === 'rejectedAttrs') return rejectedAttrsSideEvidence(dnaState, side.keys, side.min);
  return { matches: false, count: 0, hasLove: false, supportingCardIds: [] };
}

function sideConfidenceContribution(ev) {
  return Math.min(1, ev.count / 4) * 0.7 + (ev.hasLove ? 0.3 : 0);
}

/**
 * Runs the full TENSION_LIBRARY against current state and returns the
 * TravelDNATension objects that have real evidence on BOTH sides — a
 * tension with only one side supported isn't returned at all ("do not
 * create tensions from one card"). Confirmed/rejected user feedback
 * overrides the computed status: confirmed tensions always read as
 * 'confirmed', rejected ones as 'rejected' (and are filtered out of
 * prominent display by getStrongestTensions).
 */
function detectTensions(dnaState) {
  const confirmed = new Set((dnaState.confirmedTensions || []).map(t => t.id));
  const rejected = new Set((dnaState.rejectedTensions || []).map(t => t.id));

  return TENSION_LIBRARY.map(def => {
    const evA = evaluateTensionSide(dnaState, def.signalA);
    const evB = evaluateTensionSide(dnaState, def.signalB);
    // Requires at least 2 distinct supporting cards on EACH side — a
    // single card, however strong, never creates a tension.
    if (evA.count < 2 || evB.count < 2) return null;

    let confidence = Math.round(((sideConfidenceContribution(evA) + sideConfidenceContribution(evB)) / 2) * 100) / 100;
    confidence = Math.min(1, confidence);

    let status = confidence >= 0.6 ? 'strong' : 'emerging';
    if (confirmed.has(def.id)) status = 'confirmed';
    else if (rejected.has(def.id)) status = 'rejected';

    return {
      id: def.id, title: def.title, insightText: def.insightText, confidence,
      signalA: { label: def.signalA.label, attributes: def.signalA.keys, supportingCardIds: evA.supportingCardIds },
      signalB: { label: def.signalB.label, attributes: def.signalB.keys, supportingCardIds: evB.supportingCardIds },
      relatedDimensions: def.relatedDimensions,
      recommendationImplication: def.recommendationImplication,
      status,
    };
  }).filter(Boolean);
}

/** Curated top N for the summary — strong or user-confirmed only, never 'emerging', never 'rejected'. */
function getStrongestTensions(dnaState, n = 4) {
  return detectTensions(dnaState)
    .filter(t => t.status === 'strong' || t.status === 'confirmed')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, n);
}

/**
 * Offers a tension for confirmation once it reaches medium confidence
 * (0.5 — a bit below the 0.6 'strong' bar, so confirming one gives it a
 * head start toward prominent display rather than making the user wait
 * for it to clear the bar unprompted). Same shown-once + cooldown-gap
 * pattern as generateInsightCheck, tracked with its own counters so the
 * two confirmation flows don't interfere with each other.
 */
function generateTensionCheck(dnaState) {
  const swipeCount = dnaState.swipeCount || 0;
  if (swipeCount < 12) return null;

  const lastShown = dnaState.lastTensionCheckSwipeCount || 0;
  if (lastShown > 0 && swipeCount - lastShown < 6) return null;

  const alreadyShown = new Set([
    ...(dnaState.confirmedTensions || []),
    ...(dnaState.rejectedTensions || []),
    ...(dnaState.unsureTensions || []),
  ].map(t => t.id));

  const candidates = detectTensions(dnaState).filter(t => !alreadyShown.has(t.id) && t.confidence >= 0.5);
  if (!candidates.length) return null;

  candidates.sort((a, b) => b.confidence - a.confidence);
  const tension = candidates[0];
  return { id: `${tension.id}_${swipeCount}`, tensionId: tension.id, tension, status: 'pending', shownAtSwipeCount: swipeCount };
}

/**
 * Confirm = strengthen: bumps the raw dimension poles / profile attributes
 * behind both sides, same +1 nudge applyInsightFeedback already uses for
 * confirmed insights. Reject = weaken: halves them, same 0.5x decay
 * applyInsightFeedback uses for rejected ones — the tension itself is also
 * recorded as rejected, which permanently excludes it (and would exclude a
 * near-duplicate defined the same way) from prominent display going
 * forward. Unsure changes nothing but leaves the tension eligible to be
 * asked about again once more evidence comes in.
 */
function applyTensionFeedback(dnaState, tensionCheck, feedback) {
  const updated = { ...dnaState };
  const def = tensionById(tensionCheck.tensionId);
  const record = { id: tensionCheck.tensionId, title: tensionCheck.tension.title, status: feedback, shownAtSwipeCount: tensionCheck.shownAtSwipeCount };

  if (def && (feedback === 'confirmed' || feedback === 'rejected')) {
    const bumpFactor = feedback === 'confirmed' ? 1 : 0.5;
    const bumpOp = feedback === 'confirmed' ? (v => v + 1) : (v => v * 0.5);
    [def.signalA, def.signalB].forEach(side => {
      if (side.type === 'profile') {
        const profile = { ...updated.profile };
        side.keys.forEach(k => { if ((profile[k] || 0) >= 0) profile[k] = bumpOp(profile[k] || 0); });
        updated.profile = profile;
      } else if (side.type === 'dimensionPole') {
        const dimState = { raw: { ...(updated.dimensionState || dnaState.dimensionState).raw }, evidenceCardIds: { ...(updated.dimensionState || dnaState.dimensionState).evidenceCardIds } };
        side.keys.forEach(k => { if ((dimState.raw[k] || 0) >= 0) dimState.raw[k] = bumpOp(dimState.raw[k] || 0); });
        updated.dimensionState = dimState;
      }
      // 'rejectedAttrs' sides aren't bumped — they're read off actual No
      // swipes, which already are what they are.
    });
  }

  if (feedback === 'confirmed') updated.confirmedTensions = [...(dnaState.confirmedTensions || []), record];
  else if (feedback === 'rejected') updated.rejectedTensions = [...(dnaState.rejectedTensions || []), record];
  else updated.unsureTensions = [...(dnaState.unsureTensions || []), record];

  updated.lastTensionCheckSwipeCount = dnaState.swipeCount;
  return updated;
}

// ---- Evidence chains + summary orchestration -----------------------------
// Cards -> Signals -> Dimensions -> Tensions -> What we're learning ->
// Recommendations. This layer turns dimension/tension results into a
// curated, deduped summary and gives every major claim a "Why we think
// this" trail back to REAL swipes — never fabricated. Evidence is always
// read off dnaState.swipes / EXPERIENCE_CARDS at render time, not stored
// pre-baked, so it can never drift from what actually happened.

/** Splits a set of card ids into loved/liked, based on the user's ACTUAL swipe on each. */
function classifySwipesByType(dnaState, cardIds) {
  const loved = [];
  const liked = [];
  cardIds.forEach(cid => {
    const sw = (dnaState.swipes || []).find(s => s.cardId === cid);
    if (!sw) return;
    if (sw.type === 'love') loved.push(cid);
    else if (sw.type === 'yes') liked.push(cid);
  });
  return { loved, liked };
}

/** Tags/subdimensions repeated across a set of evidence cards — only ones seen `minCount`+ times count as a real pattern, not noise. */
function repeatedTagsFrom(cardIds, minCount) {
  const freq = {};
  cardIds.forEach(cid => {
    const card = EXPERIENCE_CARDS.find(c => c.id === cid);
    if (!card) return;
    [...(card.tags || []), ...(card.subdimensions || [])].forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  });
  return Object.entries(freq).filter(([, n]) => n >= minCount).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 4);
}

/**
 * Evidence for a dimension result: supporting = cards that pushed the
 * LEADING pole, opposing = cards that pushed the trailing one (real
 * evidence for the road not taken, not fabricated — these are cards the
 * user positively swiped that happen to argue the other way).
 */
function generateEvidenceForDimension(dnaState, dimResult) {
  const def = dimensionById(dimResult.id);
  if (!def) return null;
  const leadingKey = dimResult.leadingPole === dimResult.poleA ? def.keyA : def.keyB;
  const trailingKey = dimResult.leadingPole === dimResult.poleA ? def.keyB : def.keyA;
  const supportingCardIds = pickEvidenceCardIdsForPoles(dnaState, [leadingKey], 6);
  const opposingCardIds = pickEvidenceCardIdsForPoles(dnaState, [trailingKey], 4);
  const { loved, liked } = classifySwipesByType(dnaState, supportingCardIds);
  return {
    id: `evidence_${dimResult.id}`, targetType: 'dimension', targetId: dimResult.id,
    confidence: dimResult.confidence,
    supportingCardIds, opposingCardIds,
    supportingTags: repeatedTagsFrom(supportingCardIds, 2),
    opposingTags: repeatedTagsFrom(opposingCardIds, 1),
    patternSummary: dimResult.summary,
    loved, liked,
  };
}

/**
 * Evidence for a tension: supporting = both sides' cards (a tension's
 * "supporting" evidence is the CONTRADICTION itself — both sides are real).
 * Opposing only gets populated when a side is a `rejectedAttrs` type (an
 * actual literal No-swipe), never inferred.
 */
function generateEvidenceForTension(dnaState, tensionResult) {
  const def = tensionById(tensionResult.id);
  if (!def) return null;
  const supportingCardIds = [...tensionResult.signalA.supportingCardIds, ...tensionResult.signalB.supportingCardIds];
  const { loved, liked } = classifySwipesByType(dnaState, supportingCardIds);
  const opposingCardIds = [def.signalA, def.signalB]
    .filter(s => s.type === 'rejectedAttrs')
    .flatMap(s => rejectedAttrsSideEvidence(dnaState, s.keys, s.min).supportingCardIds);
  return {
    id: `evidence_${tensionResult.id}`, targetType: 'tension', targetId: tensionResult.id,
    confidence: tensionResult.confidence,
    supportingCardIds, opposingCardIds,
    supportingTags: repeatedTagsFrom(supportingCardIds, 2),
    opposingTags: repeatedTagsFrom(opposingCardIds, 1),
    patternSummary: tensionResult.insightText,
    loved, liked,
  };
}

/**
 * Resolves an evidence object into display-ready titles, capped so the UI
 * never dumps a huge list. Returns HTML fragments, not plain text — each
 * title comes back wrapped in <em> so every consumer (the evidence
 * sentence, the "Why we think this" lists) italicizes just the card label
 * without needing to know or duplicate that formatting decision itself.
 */
function getWhyWeThinkThis(evidence, maxEach = 3) {
  if (!evidence) return { loved: [], liked: [], rejected: [], patternSummary: '' };
  // Cards carry a full evocative title for the swipe deck itself, plus a
  // short (2-4 word) activity label for citing them back later — evidence
  // lists quoting 5+ full sentences read as unreadable noise, not proof.
  const titleOf = id => { const c = EXPERIENCE_CARDS.find(x => x.id === id); return c ? `<em>${c.short || shortenForInline(c.title)}</em>` : id; };
  return {
    loved: (evidence.loved || []).slice(0, maxEach).map(titleOf),
    liked: (evidence.liked || []).slice(0, maxEach).map(titleOf),
    rejected: (evidence.opposingCardIds || []).slice(0, maxEach).map(titleOf),
    patternSummary: evidence.patternSummary || '',
  };
}

/** One short sentence for Insight/Learning Check prompts — "Why we're asking." */
function buildEvidenceLine(dnaState, evidence) {
  const why = getWhyWeThinkThis(evidence, 2);
  const parts = [];
  if (why.loved.length) parts.push(`loved ${why.loved.join(' and ')}`);
  if (why.liked.length) parts.push(`liked ${why.liked.join(' and ')}`);
  if (why.rejected.length) parts.push(`passed on ${why.rejected.join(' and ')}`);
  if (!parts.length) return '';
  return `You ${parts.join(', ')}.`;
}

function rankSummaryItems(items) {
  return [...items].sort((a, b) => b.confidence - a.confidence);
}

/**
 * Removes summary-item candidates that would repeat something already
 * shown elsewhere: anything in the exclude lists (already featured as a
 * top dimension/tension), plus any leftover DIMENSION whose id is
 * referenced by a leftover TENSION's relatedDimensions — the tension is
 * the more specific idea, so it wins and the flatter dimension version of
 * the same point is dropped rather than shown twice.
 */
function dedupeOverlappingSummaryItems(pool, excludeDimIds, excludeTensionIds) {
  const dimIdsCoveredByTensions = new Set(
    pool.filter(i => i.kind === 'tension').flatMap(i => (tensionById(i.id) || {}).relatedDimensions || [])
  );
  return pool.filter(item => {
    if (item.kind === 'dimension') {
      if (excludeDimIds.includes(item.id)) return false;
      if (dimIdsCoveredByTensions.has(item.id)) return false;
    }
    if (item.kind === 'tension' && excludeTensionIds.includes(item.id)) return false;
    return true;
  });
}

/**
 * "What we're learning" — the next tier of resolved dimensions/tensions
 * that didn't make the top-5/top-4 headline cut. Deliberately NOT a
 * separate content-authoring pass: reusing the same dimension.summary /
 * tension.insightText that would otherwise go unseen guarantees these are
 * never a duplicate of what's already on the page, because they're
 * structurally excluded from appearing twice.
 */
function generateLearningObservations(dnaState, excludeDimIds, excludeTensionIds, n = 3) {
  const allDims = calculateDimensionScores(dnaState).filter(d => d.status !== 'unresolved');
  const allTensions = detectTensions(dnaState).filter(t => t.status === 'strong' || t.status === 'confirmed');
  const pool = [
    ...allDims.map(d => ({ kind: 'dimension', id: d.id, confidence: d.confidence, text: d.summary, raw: d })),
    ...allTensions.map(t => ({ kind: 'tension', id: t.id, confidence: t.confidence, text: t.insightText, raw: t })),
  ];
  const deduped = dedupeOverlappingSummaryItems(pool, excludeDimIds, excludeTensionIds);
  return rankSummaryItems(deduped).slice(0, n);
}

/**
 * "Still testing" — genuinely unresolved questions, sourced from three
 * places: dimensions with too little evidence to lean either way, tensions
 * with partial (not-yet-'strong') evidence, and domains where the user's
 * swipes have gone both ways often enough that neither reading is safe yet.
 */
function generateStillTestingAreas(dnaState, n = 5) {
  const unresolvedDims = calculateDimensionScores(dnaState).filter(d => d.status === 'unresolved');
  const emergingTensions = detectTensions(dnaState).filter(t => t.status === 'emerging');
  const stats = domainSwipeStats(dnaState);

  const pool = [
    ...unresolvedDims.map(d => ({ text: dimensionById(d.id).question, evidenceCount: d.evidenceCardIds.length })),
    ...emergingTensions.map(t => ({ text: `${t.signalA.label}, or ${t.signalB.label.toLowerCase()}?`, evidenceCount: t.signalA.supportingCardIds.length + t.signalB.supportingCardIds.length })),
    ...Object.entries(stats)
      .filter(([, s]) => s.seen >= 4 && s.positive >= 2 && s.negative >= 2)
      .map(([domain, s]) => ({ text: `Is ${domain} a real trip driver for you, or a nice-to-have?`, evidenceCount: s.positive + s.negative })),
  ];

  return pool.sort((a, b) => b.evidenceCount - a.evidenceCount).slice(0, n).map(p => p.text);
}

/**
 * Unified confirmation flow for BOTH tensions and dimension-derived
 * learning observations — one candidate pool, one cooldown, so at most one
 * confirmable card ever interrupts a swipe (see generateInsightCheck /
 * generateTensionCheck for the same shape; this supersedes calling those
 * two separately from handleSwipe).
 */
function generateLearningCheck(dnaState) {
  const swipeCount = dnaState.swipeCount || 0;
  if (swipeCount < 12) return null;

  const lastShown = dnaState.lastLearningCheckSwipeCount || 0;
  if (lastShown > 0 && swipeCount - lastShown < 6) return null;

  const shownTensionIds = new Set([
    ...(dnaState.confirmedTensions || []), ...(dnaState.rejectedTensions || []), ...(dnaState.unsureTensions || []),
  ].map(t => t.id));
  const shownDimIds = new Set([
    ...(dnaState.confirmedDimensionLearnings || []), ...(dnaState.rejectedDimensionLearnings || []), ...(dnaState.unsureDimensionLearnings || []),
  ].map(d => d.id));

  const tensionCandidates = detectTensions(dnaState)
    .filter(t => !shownTensionIds.has(t.id) && t.confidence >= 0.5)
    .map(t => ({
      kind: 'tension', id: t.id, confidence: t.confidence, title: t.title, insightText: t.insightText,
      evidenceLine: buildEvidenceLine(dnaState, generateEvidenceForTension(dnaState, t)),
    }));

  const dimCandidates = calculateDimensionScores(dnaState)
    .filter(d => !shownDimIds.has(d.id) && d.status !== 'unresolved' && d.confidence >= 0.5)
    .map(d => ({
      kind: 'dimension', id: d.id, confidence: d.confidence, title: d.label, insightText: d.summary,
      evidenceLine: buildEvidenceLine(dnaState, generateEvidenceForDimension(dnaState, d)),
    }));

  const all = [...tensionCandidates, ...dimCandidates].sort((a, b) => b.confidence - a.confidence);
  if (!all.length) return null;
  const chosen = all[0];
  return { id: `${chosen.kind}_${chosen.id}_${swipeCount}`, ...chosen, shownAtSwipeCount: swipeCount };
}

/**
 * Confirm = strengthen, reject = weaken, unsure = leave as still-testing —
 * same pattern as applyInsightFeedback/applyTensionFeedback. Tension-kind
 * checks just delegate straight to applyTensionFeedback; dimension-kind
 * checks bump the leading pole's raw score the same way.
 */
function applyLearningFeedback(dnaState, check, feedback) {
  if (check.kind === 'tension') {
    const tensionCheckShape = { tensionId: check.id, tension: { title: check.title }, shownAtSwipeCount: check.shownAtSwipeCount };
    const updated = applyTensionFeedback(dnaState, tensionCheckShape, feedback);
    updated.lastLearningCheckSwipeCount = dnaState.swipeCount;
    return updated;
  }

  const updated = { ...dnaState };
  const def = dimensionById(check.id);
  const record = { id: check.id, title: check.title, status: feedback, shownAtSwipeCount: check.shownAtSwipeCount };

  if (def && (feedback === 'confirmed' || feedback === 'rejected')) {
    const bumpOp = feedback === 'confirmed' ? (v => v + 1) : (v => v * 0.5);
    const dimScore = calculateDimensionScores(dnaState).find(d => d.id === check.id);
    const leadingKey = dimScore && dimScore.leadingPole === def.poleA ? def.keyA : def.keyB;
    const dimState = { raw: { ...dnaState.dimensionState.raw }, evidenceCardIds: { ...dnaState.dimensionState.evidenceCardIds } };
    if ((dimState.raw[leadingKey] || 0) >= 0) dimState.raw[leadingKey] = bumpOp(dimState.raw[leadingKey] || 0);
    updated.dimensionState = dimState;
  }

  if (feedback === 'confirmed') updated.confirmedDimensionLearnings = [...(dnaState.confirmedDimensionLearnings || []), record];
  else if (feedback === 'rejected') updated.rejectedDimensionLearnings = [...(dnaState.rejectedDimensionLearnings || []), record];
  else updated.unsureDimensionLearnings = [...(dnaState.unsureDimensionLearnings || []), record];

  updated.lastLearningCheckSwipeCount = dnaState.swipeCount;
  return updated;
}

// ---- Calibration --------------------------------------------------------------
/**
 * Calibration is deliberately NOT just "swipes / 30". It rewards a profile
 * that's actually informative: enough swipes, spread across enough
 * categories (so we're not just guessing from one obsession), a couple of
 * confirmed insights (independent validation), and some decisive Love
 * swipes (a flat stream of "meh" Yeses is weaker signal than a few strong
 * Loves). Every component is capped so no single dimension can blow past
 * its share, and the total is capped at 100.
 */
/**
 * Calibration is intentionally slow to start. By design, 10 swipes alone
 * should land under 10% no matter how the swipes go (broad, narrow, all
 * Love, whatever) — the meter should read as genuinely earned over a real
 * session, not something that fills up in the first minute of swiping.
 *
 * The trick to guaranteeing that isn't just "divide by a bigger number" —
 * a purely linear base can still get pushed over 10% at swipe 10 by the
 * diversity/love bonuses stacking on top of it (diversity in particular
 * climbs fast early on, since the adaptive selector deliberately front-
 * loads category coverage). So `base` uses an S-CURVE (see sCurve below)
 * rather than a monotonically-accelerating convex one: slow through
 * roughly the first 8 swipes, picking up noticeably through the middle of
 * a session, then decelerating again as it approaches the full 60-swipe
 * budget — filling in the last details of an already-mostly-known profile
 * should feel slower than the middle stretch did, not keep accelerating
 * forever. The diversity/love bonuses are additionally damped by early-
 * session progress on top of that — both worth checking by hand at swipe
 * 10: even in the worst case (max plausible diversity + a 100% Love
 * ratio), the total stays comfortably under 10.
 */
/**
 * Logistic S-curve normalized so f(0)=0 and f(1)=1 — used to shape
 * calibration's base component. `midpoint` sets where the curve is
 * steepest (as a fraction of progress 0-1); `steepness` controls how sharp
 * the slow -> fast -> slow transitions are.
 */
function sCurve(progress, midpoint, steepness) {
  const sigmoid = x => 1 / (1 + Math.exp(-x));
  const raw = sigmoid(steepness * (progress - midpoint));
  const at0 = sigmoid(steepness * (0 - midpoint));
  const at1 = sigmoid(steepness * (1 - midpoint));
  return (raw - at0) / (at1 - at0);
}

function calculateCalibrationPercent(dnaState) {
  const swipeCount = dnaState.swipeCount || 0;
  if (swipeCount === 0) return 0;

  const MAX_BASE_SWIPES = 60;
  const progress = Math.min(swipeCount / MAX_BASE_SWIPES, 1);
  const earlyDamper = Math.min(progress * 2, 1); // ramps 0->1 over the first ~30 swipes

  // Base: swipe volume, S-curved — worth up to 69 of the 100 points.
  const base = sCurve(progress, 0.55, 7) * 69;

  // Diversity: touching many categories means less risk of overfitting to
  // one obsession. Worth up to 12 points, damped early since the adaptive
  // selector can rack up category coverage fast on its own.
  const diversityBonus = calculateCategoryDiversity(dnaState) * 12 * earlyDamper;

  // Confirmed insights are independent validation, not just more swipes.
  // Worth up to 15 points (3 each, capped at 5 counted insights). No extra
  // damping needed — insight checks are already gated to swipe 12+.
  const confirmedCount = (dnaState.confirmedInsights || []).length;
  const insightBonus = Math.min(confirmedCount, 5) * 3;

  // A stream of decisive Love swipes is more informative than lukewarm
  // Yeses, but capped low and damped early so an all-Love opening streak
  // can't spike the meter on its own.
  const loveCount = (dnaState.swipes || []).filter(s => s.type === 'love').length;
  const loveRatio = swipeCount ? loveCount / swipeCount : 0;
  const loveBonus = Math.min(loveRatio * 8, 4) * earlyDamper;

  const total = base + diversityBonus + insightBonus + loveBonus;
  return Math.max(0, Math.min(100, Math.round(total)));
}

/** Ratio (0..1) of distinct categories swiped vs. a realistic diversity target. */
function calculateCategoryDiversity(dnaState) {
  const answeredIds = dnaState.answeredCardIds || [];
  if (!answeredIds.length) return 0;
  const categories = new Set();
  answeredIds.forEach(id => {
    const card = EXPERIENCE_CARDS.find(c => c.id === id);
    if (card) categories.add(card.category);
  });
  // Target a healthy spread of what's actually still eligible, not the full
  // dataset — a user with no kids shouldn't be marked "less diverse" for
  // never touching Family, since Family was never offered to them.
  const eligibleCategoryCount = new Set(getEligibleCards(dnaState).map(c => c.category)).size;
  const target = Math.min(eligibleCategoryCount || CARD_CATEGORIES.length, 12);
  return Math.min(categories.size / target, 1);
}

// The "want to see matches yet?" nudge re-appears at each of these
// calibration milestones (not just once ever) — a user who says "keep
// refining" at 50% should get asked again at 70%, 90%, and 100%, each time
// with a stronger read behind it. 100% is handled as a special case (the
// full summary screen) rather than the lightweight soft-exit interstitial.
const CALIBRATION_MILESTONES = [50, 70, 90, 100];

/** Returns the next calibration milestone crossed but not yet shown, or null. */
function nextUnshownCalibrationMilestone(dnaState) {
  const shown = new Set(dnaState.calibrationMilestonesShown || []);
  return CALIBRATION_MILESTONES.find(m => dnaState.calibrationPercent >= m && !shown.has(m)) || null;
}

function calibrationStatusText(percent) {
  if (percent <= 0) return "You're a blank slate — let's find out what you actually like.";
  if (percent < 10) return 'Almost no signal yet.';
  if (percent < 25) return 'Starting to pick up a few clues.';
  if (percent < 45) return 'Some patterns are emerging.';
  if (percent < 65) return 'Your travel taste is getting clearer.';
  if (percent < 85) return "We're getting useful signal now.";
  if (percent < 100) return 'Strong read. A few more swipes will sharpen it.';
  return 'Profile calibrated. Recommendations should now feel meaningfully more personal.';
}

// ---- Basics-driven card eligibility --------------------------------------------
/**
 * Hard excludes — not deprioritization, actual removal from the pool —
 * based on what the user said in the Basics step before swiping started.
 * This is deliberately conservative: it only rules out cards that would
 * feel like an obvious mismatch (asking a luxury-only, no-kids traveler to
 * rate a cold-shower family camping trip), not anything the user merely
 * hasn't expressed enthusiasm for yet. Bands left at "everything selected"
 * (the default — no stated preference) never exclude anything.
 */
/**
 * The Basics-driven checks, split out from isCardEligible so a deep card can
 * be tested against them WITHOUT the deep-dive gate (used when building a
 * deep-dive's question queue — see buildDeepDiveQueue below — since at that
 * point we already know the domain is active and just need to know whether
 * budget/companions/physical/vibe rule a specific card out).
 */
function passesBasicsFilters(card, dnaState) {
  const companions = dnaState.companions || [];
  const bands = dnaState.bands || allBandsSelected();
  const signals = card.preferenceSignals || {};

  // Companions: skip family-oriented moments for travelers who never
  // mentioned kids.
  if (!companions.includes('kids') && card.category === 'Family') return false;

  // Budget & Comfort: ruling out "Basic / Budget" means "no roughing it" —
  // excluded directly by category rather than a luxury-signal threshold,
  // since individual cards don't all carry the same negative luxury value
  // (some rustic cards are -1, some -2, and rustic_local_homestay carries
  // none at all) — a signal-only check let plenty of roughing-it cards
  // slip through even when the user clearly opted out of them. Ruling out
  // Basic AND Comfortable both (wants only High-End/Luxury) gets a
  // stricter cut: any card with a real negative luxury signal, not just
  // the most extreme ones.
  const budget = bands.budget || [];
  const excludesBasic = budget.length > 0 && !budget.includes('basic');
  const wantsOnlyLuxury = excludesBasic && !budget.includes('comfortable');
  const wantsOnlyBudget = budget.length > 0 && !budget.includes('highend') && !budget.includes('luxury');
  if (excludesBasic && card.category === 'Rustic Adventure') return false;
  if (wantsOnlyLuxury && (signals.luxury || 0) <= -1) return false;
  if (wantsOnlyBudget && (signals.luxury || 0) >= 3) return false;

  // Physical Demand: someone who only wants easy/moderate trips doesn't
  // need the most physically extreme cards in the deck.
  const physical = bands.physical || [];
  const easyOnly = physical.length === 1 && physical.includes('easy');
  const excludesDemanding = physical.length > 0 && !physical.includes('active') && !physical.includes('challenging');
  if (easyOnly && (signals.physicalChallenge || 0) >= 2) return false;
  if (excludesDemanding && (signals.physicalChallenge || 0) >= 3) return false;

  // Social Vibe: secluded/easygoing-only travelers don't need heavy
  // nightlife/party cards.
  const vibe = bands.vibe || [];
  const wantsQuietOnly = vibe.length > 0 && !vibe.includes('lively') && !vibe.includes('highenergy');
  if (wantsQuietOnly && (signals.nightlife || 0) >= 3) return false;

  // Weather isn't used to exclude cards — cards aren't tagged with a
  // temperature, so there's nothing concrete to filter on yet. It still
  // gets collected in Basics and carried into the destination app's Open To
  // bands for later.
  return true;
}

/**
 * Deep cards are invisible except during their own domain's committed
 * deep-dive block — this is the core mechanic of "ask a real set of
 * questions about a theme, not one or two mixed into everything else."
 * Unlike the old model (deep card eligible any time its domain was
 * unlocked, competing probabilistically with broad cards), a deep card is
 * only eligible while dnaState.activeDeepDive is running for that exact
 * domain AND the card is one of the cards chosen for that specific block
 * (see buildDeepDiveQueue). Once the block ends, activeDeepDive clears and
 * every deep card in that domain goes back to ineligible — permanently
 * done, not just "deprioritized" — because completedDeepDives already
 * captured what we learned.
 */
function isCardEligible(card, dnaState) {
  if (card.stage === 'deep') {
    const dive = dnaState.activeDeepDive;
    if (!dive || dive.domain !== card.domain || !dive.queue.includes(card.id)) return false;
  }
  return passesBasicsFilters(card, dnaState);
}

function getEligibleCards(dnaState) {
  return EXPERIENCE_CARDS.filter(c => isCardEligible(c, dnaState));
}

// ---- Hierarchical domain tracking & unlock logic -------------------------------
/**
 * Per-domain swipe tally, built the same way categorySwipeStats() is, but
 * using cardDomains() (domains.js) instead of a raw category match — so a
 * card can count toward more than one domain (or none) depending on how the
 * registry defines that domain's signal.
 */
function domainSwipeStats(dnaState) {
  const stats = {};
  (dnaState.swipes || []).forEach(sw => {
    const card = EXPERIENCE_CARDS.find(c => c.id === sw.cardId);
    if (!card) return;
    cardDomains(card).forEach(domainKey => {
      if (!stats[domainKey]) stats[domainKey] = { seen: 0, positive: 0, negative: 0, love: 0 };
      stats[domainKey].seen += 1;
      if (sw.type === 'no') {
        stats[domainKey].negative += 1;
      } else {
        stats[domainKey].positive += 1;
        if (sw.type === 'love') stats[domainKey].love += 1;
      }
    });
  });
  return stats;
}

function isDomainUnlocked(dnaState, domainKey) {
  return (dnaState.unlockedDomains || []).includes(domainKey);
}

/**
 * Checks every domain that HAS a deep card set (hasDeepCards: true) and
 * returns any that newly cross their unlock threshold this swipe. Per the
 * product rule, that's "2+ Love swipes OR 4+ positive swipes" by default
 * (each domain can override via its own `unlock` config in domains.js) —
 * deliberately not triggerable by a single enthusiastic swipe, since a Love
 * swipe alone only adds 1 to the love tally and 1 to the positive tally.
 * Already-unlocked domains are skipped so this never re-fires.
 */
function checkDomainUnlocks(dnaState) {
  const stats = domainSwipeStats(dnaState);
  const newlyUnlocked = [];
  Object.values(DOMAIN_REGISTRY).forEach(def => {
    if (!def.hasDeepCards) return;
    if (isDomainUnlocked(dnaState, def.key)) return;
    const s = stats[def.key];
    if (!s) return;
    const rule = def.unlock || { minPositive: 4, minLove: 2 };
    if (s.love >= rule.minLove || s.positive >= rule.minPositive) {
      newlyUnlocked.push(def.key);
    }
  });
  return newlyUnlocked;
}

// ---- Committed deep-dive question blocks ---------------------------------------
/**
 * Builds the ordered set of deep-card ids for one domain's committed
 * question block, up to `desiredCount` cards (dna-ui.js's startDeepDive
 * caller picks a random 6-10 as the actual target). Cards are stratified by
 * subdimension coverage — round-robining through the domain's declared
 * subdimensions and taking one unseen card per subdimension per pass —
 * rather than picked at random, so a 6-10 question block probes as many
 * distinct facets of the domain as possible instead of asking several
 * near-duplicate questions back to back. Falls back to filling with
 * whatever's left if subdimension coverage alone doesn't reach the target
 * (e.g. heavy overlap between cards' subdimension tags).
 */
function buildDeepDiveQueue(domainKey, dnaState, allCards, desiredCount) {
  const domainDef = DOMAIN_REGISTRY[domainKey] || {};
  const answered = new Set(dnaState.answeredCardIds || []);
  const candidates = allCards.filter(c =>
    c.stage === 'deep' && c.domain === domainKey && !answered.has(c.id) && passesBasicsFilters(c, dnaState)
  );
  if (!candidates.length) return [];

  const subdims = domainDef.subdimensions || [];
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const bySubdim = new Map(subdims.map(s => [s, []]));
  shuffled.forEach(c => {
    (c.subdimensions || []).forEach(s => { if (bySubdim.has(s)) bySubdim.get(s).push(c); });
  });

  const picked = [];
  const pickedIds = new Set();
  let madeProgress = true;
  while (madeProgress && picked.length < desiredCount) {
    madeProgress = false;
    for (const s of subdims) {
      if (picked.length >= desiredCount) break;
      const list = bySubdim.get(s) || [];
      const next = list.find(c => !pickedIds.has(c.id));
      if (next) { picked.push(next); pickedIds.add(next.id); madeProgress = true; }
    }
  }
  if (picked.length < desiredCount) {
    for (const c of shuffled) {
      if (picked.length >= desiredCount) break;
      if (!pickedIds.has(c.id)) { picked.push(c); pickedIds.add(c.id); }
    }
  }
  return picked.map(c => c.id);
}

/**
 * Starts a new committed deep-dive block for a domain: 6-10 questions
 * (randomized per the product rule "at least 6-10 questions about a
 * specific theme"), trimmed down to however many relevant cards actually
 * exist if fewer are available. `target` is set to the ACTUAL queue length,
 * not the desired count, so isDeepDiveComplete() below has a real number to
 * compare against even when a domain has fewer eligible deep cards than the
 * usual 19-20 (e.g. most were filtered out by Basics answers).
 */
function startDeepDive(domainKey, dnaState, allCards) {
  const MIN_QUESTIONS = 6;
  const MAX_QUESTIONS = 10;
  const desired = MIN_QUESTIONS + Math.floor(Math.random() * (MAX_QUESTIONS - MIN_QUESTIONS + 1));
  const queue = buildDeepDiveQueue(domainKey, dnaState, allCards, desired);
  return { domain: domainKey, queue, seenCount: 0, target: queue.length };
}

/** True once the active deep dive has hit its question target or run out of queued cards. */
function isDeepDiveComplete(dnaState) {
  const dive = dnaState.activeDeepDive;
  if (!dive) return false;
  const answered = new Set(dnaState.answeredCardIds || []);
  const remaining = dive.queue.filter(id => !answered.has(id));
  return dive.seenCount >= dive.target || remaining.length === 0;
}

// ---- Adaptive card selection ---------------------------------------------------
/**
 * How the next card is picked. Two goals that were in tension in an earlier
 * version of this function:
 *   1. Learn what the user likes (adaptive — exploit strong signal).
 *   2. Never let early enthusiasm for one category quietly starve out
 *      completely unrelated categories the user hasn't been asked about.
 *
 * So every pick first checks whether any category has zero swipes on it at
 * all. If so, there's a strong (but not guaranteed) chance the next card
 * comes from one of those untouched categories — and this keeps running
 * for as long as unexplored categories remain, not just for a fixed first
 * few swipes. That's what a fixed "first 8 swipes" window got wrong: a
 * user who happened to love several wildlife/nature cards early could go
 * an entire session without ever seeing a golf, skiing, wine, spa or
 * shopping card, because after swipe 8 the algorithm assumed it already
 * knew enough to start heavily exploiting. Now it keeps sampling blind
 * spots until there genuinely aren't any left.
 *
 * Once every category has been sampled at least once, selection becomes
 * preference-driven: score unanswered cards by alignment with the current
 * profile (a dot product of the card's preferenceSignals against the
 * profile). Categories with 2+ more "no" swipes than positive ones are
 * treated as rejected and heavily suppressed — but kept in a small
 * resurfacing pool (~1 in 10) rather than eliminated outright, since a
 * couple of "not interested" answers on one flavor of a category shouldn't
 * permanently rule out every card that shares its tag.
 */
function alignmentScore(card, profile) {
  return Object.entries(card.preferenceSignals || {}).reduce((sum, [attr, signal]) => {
    const pref = profile[attr] || 0;
    return sum + signal * pref;
  }, 0);
}

/** Per-category swipe tally: how many times has each category been shown, and how did it go. */
function categorySwipeStats(dnaState, allCards) {
  const stats = {};
  (dnaState.swipes || []).forEach(sw => {
    const card = allCards.find(c => c.id === sw.cardId);
    if (!card) return;
    if (!stats[card.category]) stats[card.category] = { seen: 0, positive: 0, negative: 0 };
    stats[card.category].seen += 1;
    if (sw.type === 'no') stats[card.category].negative += 1;
    else stats[card.category].positive += 1; // yes or love
  });
  return stats;
}

/**
 * A committed deep dive, when one is running, owns the deck exclusively: the
 * next card is always the next unseen card in dnaState.activeDeepDive.queue,
 * deterministically, no mixing with broad or calibration cards. That's what
 * makes "we're going deeper on Birding" actually feel like a coherent block
 * of 6-10 questions in a row rather than one deep card sprinkled in every
 * few swipes. dna-ui.js is responsible for noticing when the block finishes
 * (isDeepDiveComplete) and clearing activeDeepDive — by the time that
 * happens, this function has nothing special left to do for that domain.
 *
 * Once no deep dive is active, every eligible category is first bucketed
 * by categoryInterestTier() (interests.js) based on what the user picked
 * in the Step 1 interest picker — this is what stops someone who picked
 * only "Beach & Sun" from getting cold-opened with a downhill-gravel
 * cycling card. Categories the picker doesn't gate at all ('unrestricted'
 * — nobody picked anything; 'tier1' — mainstream categories like Food or
 * Cities that aren't gated regardless; 'unlocked' — directly picked) flow
 * through the modes below exactly as they always have. Categories that
 * are merely 'correlated' to a pick (Golf implies some chance of Beach,
 * even if Beach wasn't picked) or fully 'locked' (neither picked nor
 * correlated) are excluded from the normal pools and only get their own
 * separate, much smaller trickle chances (see Mode 1.5 below) — enough
 * that a locked category is never TRULY undiscoverable, just rare.
 *
 * Selection then happens in priority order — each a "pool + probability"
 * gate, so higher-priority modes don't always win, they just get first
 * crack at each pick:
 *
 *   1. BROAD DISCOVERY — any non-gated category has zero swipes on it at
 *      all, OR a domain with a deep card set shows early promise (1+ Love
 *      or 2+ positive swipes) but hasn't unlocked yet. Both compete for
 *      the same priority slot, which is what actually lets a promising
 *      domain accumulate enough repeated exposure to reach its unlock
 *      threshold — without this, a domain loved on its very first swipe
 *      would count as "explored" and get starved out by other untouched
 *      categories.
 *   1.5 CORRELATED TRICKLE — a smaller, dedicated chance for categories
 *      tied to something the user picked but not picked themselves.
 *   2. CALIBRATION REFINEMENT — once coverage is decent, score every
 *      remaining unanswered card by alignment with the current profile.
 *      This itself has three outcomes: EXPLOIT (top-scoring slice, most of
 *      the time), EXPLORE (the rejected-but-not-eliminated tail, occasionally
 *      — locked/correlated categories fold into this same suppressed pool),
 *      and DIAGNOSTIC (cards sitting in the ambiguous MIDDLE of the score
 *      range — not clearly loved, not clearly rejected — which is exactly
 *      what "test an unresolved question" means: a card that doesn't
 *      cleanly follow from what's already known).
 */
function chooseNextCard(dnaState, allCards) {
  // ---- Forced mode: a committed deep dive always wins ----
  if (dnaState.activeDeepDive) {
    const answeredForDive = new Set(dnaState.answeredCardIds || []);
    const nextId = dnaState.activeDeepDive.queue.find(id => !answeredForDive.has(id));
    if (nextId) {
      const nextCard = allCards.find(c => c.id === nextId);
      if (nextCard) return nextCard;
    }
    // Queue exhausted without dna-ui.js catching isDeepDiveComplete yet
    // (e.g. a queued card became ineligible mid-dive) — fall through to
    // normal selection this one time; the completion check on the next
    // swipe will still close the block out properly.
  }

  const eligibleCards = allCards.filter(c => isCardEligible(c, dnaState));
  const answered = new Set(dnaState.answeredCardIds || []);
  const unanswered = eligibleCards.filter(c => !answered.has(c.id));
  if (!unanswered.length) return null;

  // ---- Interest-picker tiering (see interests.js) ----
  // Every eligible category gets bucketed by how eagerly it should
  // compete for a swipe slot: 'unrestricted'/'tier1'/'unlocked' behave
  // exactly like before this feature existed. 'correlated' (not picked,
  // but tied to something that was) and 'locked' (neither) are excluded
  // from the normal exploration/exploit pools below and instead get their
  // own much smaller trickle chances — correlated somewhat more generous
  // than locked, matching the "elevated odds, not zero" product rule.
  const presentCategories = new Set(eligibleCards.map(c => c.category));
  const correlatedCategories = new Set([...presentCategories].filter(cat => categoryInterestTier(cat, dnaState) === 'correlated'));
  const lockedCategories = new Set([...presentCategories].filter(cat => categoryInterestTier(cat, dnaState) === 'locked'));
  const gatedCategories = new Set([...correlatedCategories, ...lockedCategories]);

  // ---- Mode 1: Broad discovery (unexplored categories + "promising but
  // not yet unlocked" domains) ----
  // A pure "show every category once" rule has a bug hiding in it once
  // domains can unlock: a category the user LOVED on the very first swipe
  // instantly counts as "explored" and gets deprioritized in favor of ~28
  // other categories the user hasn't touched — which can easily burn 30+
  // swipes before the domain ever gets a second chance to reach its own
  // unlock threshold. So the priority pool here is the union of two things:
  // categories with zero swipes AND (per the product rule) domains with
  // early promise — 1+ Love or 2+ positive swipes — that haven't unlocked
  // yet and still have unseen broad cards. Both compete for the same slot,
  // so genuine exploration keeps happening too. Gated (correlated/locked)
  // categories never enter this pool no matter how unexplored they are.
  const stats = categorySwipeStats(dnaState, allCards);
  const unexploredCategories = [...presentCategories]
    .filter(cat => !gatedCategories.has(cat))
    .filter(cat => !stats[cat] || stats[cat].seen === 0);

  const domainStats = domainSwipeStats(dnaState);
  const promisingDomainKeys = Object.values(DOMAIN_REGISTRY)
    .filter(def => def.hasDeepCards && !isDomainUnlocked(dnaState, def.key))
    .filter(def => {
      const s = domainStats[def.key];
      return s && (s.love >= 1 || s.positive >= 2);
    })
    .map(def => def.key);

  if (unexploredCategories.length || promisingDomainKeys.length) {
    const pool = unanswered.filter(c =>
      unexploredCategories.includes(c.category) ||
      (c.stage === 'broad' && promisingDomainKeys.length && cardDomains(c).some(d => promisingDomainKeys.includes(d)))
    );
    if (pool.length && Math.random() < 0.65) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }

  // ---- Mode 1.5: Correlated-category trickle ----
  // A real but reduced chance for categories that weren't directly picked
  // but relate to something that was (e.g. picked Golf, not Beach — Beach
  // still gets a better shot than a totally unrelated locked category).
  if (correlatedCategories.size) {
    const pool = unanswered.filter(c => correlatedCategories.has(c.category));
    if (pool.length && Math.random() < 0.3) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }

  // ---- Mode 2: Calibration refinement (exploit / explore / diagnostic) ----
  // Gated (locked/correlated) categories are excluded from this pool
  // first and HARD — unlike behavioral rejection below, that exclusion
  // must never silently fall back to the fully-unrestricted pool, or a
  // session with several behaviorally-rejected categories would quietly
  // undo the interest gate the moment "eligible" ran dry. So there are
  // two separate fallback rungs: gated-but-behaviorally-fine cards first
  // (still respects the gate), and only the FULLY unrestricted pool as a
  // last resort if truly nothing else is left to show.
  const nonGatedUnanswered = unanswered.filter(c => !gatedCategories.has(c.category));
  const behaviorallyRejected = new Set(
    Object.entries(stats).filter(([, s]) => s.negative - s.positive >= 2).map(([cat]) => cat)
  );
  const eligible = nonGatedUnanswered.filter(c => !behaviorallyRejected.has(c.category));
  const testRejectedAnyway = (behaviorallyRejected.size > 0 || gatedCategories.size > 0) && Math.random() < 0.1;
  const searchPool = testRejectedAnyway
    ? unanswered
    : (eligible.length ? eligible : (nonGatedUnanswered.length ? nonGatedUnanswered : unanswered));

  const scored = searchPool
    .map(card => ({ card, score: alignmentScore(card, dnaState.profile) }))
    .sort((a, b) => b.score - a.score);

  // Diagnostic: pick from the ambiguous middle third of the scored range —
  // cards that neither clearly align nor clearly conflict with the profile
  // so far. That's the closest thing to "test an unresolved question" this
  // scoring model can do without a bespoke contradiction-detection system:
  // a mid-range card touches attributes we have SOME signal on, but not
  // enough to already know the answer.
  if (scored.length > 6 && Math.random() < 0.15) {
    const midStart = Math.floor(scored.length * 0.35);
    const midEnd = Math.ceil(scored.length * 0.65);
    const midSlice = scored.slice(midStart, midEnd);
    if (midSlice.length) return midSlice[Math.floor(Math.random() * midSlice.length)].card;
  }

  const exploit = Math.random() < 0.7;
  const cutoff = Math.max(5, Math.ceil(scored.length * 0.35));

  if (exploit || scored.length <= cutoff) {
    const topSlice = scored.slice(0, cutoff);
    return topSlice[Math.floor(Math.random() * topSlice.length)].card;
  }
  const restSlice = scored.slice(cutoff);
  return restSlice[Math.floor(Math.random() * restSlice.length)].card;
}

// ---- Insight checks ---------------------------------------------------------------
/**
 * ONE mechanism surfaces every discovered pattern — there's no separate
 * "trait unlocked" concept with its own screen anymore. Whether the
 * pattern is broad ("crowd-sensitive") or narrow ("food is a bonus, not
 * the reason"), it goes through the same confirm/reject/unsure Insight
 * Check before it's trusted, so there's exactly one kind of interruption
 * card in the whole flow.
 *
 * Two gates before a pattern is even eligible, so nothing fires off one
 * enthusiastic swipe:
 *   1. `test(profile)` — the profile score has to clear a real threshold.
 *   2. Evidence count — at least `minEvidence` (3) DIFFERENT positive
 *      (yes/love) swipes have to have actually touched the relevant
 *      attribute(s). This is the part that was missing before: a single
 *      Love swipe on a wildlife card can push profile.wildlife well past
 *      a score threshold on its own (the 2.5x amplification), so the raw
 *      score alone isn't proof of a *pattern* — counting distinct
 *      contributing swipes is what actually enforces "a combination of
 *      3+ cards," not just a lucky/strong single swipe.
 */
function countPositiveSwipesForAttributes(dnaState, attrs) {
  return (dnaState.swipes || []).filter(sw => {
    if (sw.type === 'no') return false;
    const card = EXPERIENCE_CARDS.find(c => c.id === sw.cardId);
    if (!card) return false;
    return attrs.some(attr => (card.preferenceSignals || {})[attr] > 0);
  }).length;
}

function isTopAttribute(profile, attr, topN) {
  const sorted = Object.entries(profile).sort((a, b) => b[1] - a[1]);
  const idx = sorted.findIndex(([k]) => k === attr);
  return idx >= 0 && idx < topN;
}

/** Keeps an inline-quoted card title from turning an insight into a run-on sentence. */
function shortenForInline(title, maxWords = 9) {
  const words = title.split(' ');
  if (words.length <= maxWords) return title;
  return words.slice(0, maxWords).join(' ') + '…';
}

/**
 * Finds up to `n` real swiped card titles that actually contributed
 * positive signal to the given attributes — most recent first, so an
 * insight can point at something concrete you just did ("like when you
 * swiped yes on...") instead of staying at the abstract attribute level.
 * Returns HTML fragments (each title wrapped in <em>), same convention as
 * getWhyWeThinkThis, so composeInsightText doesn't need its own formatting.
 */
function pickEvidenceCardTitles(dnaState, attrs, n) {
  const seen = new Set();
  const titles = [];
  const swipes = [...(dnaState.swipes || [])].reverse();
  for (const sw of swipes) {
    if (sw.type === 'no') continue;
    const card = EXPERIENCE_CARDS.find(c => c.id === sw.cardId);
    if (!card || seen.has(card.id)) continue;
    if (!attrs.some(a => (card.preferenceSignals || {})[a] > 0)) continue;
    seen.add(card.id);
    titles.push(`<em>${card.short || shortenForInline(card.title)}</em>`);
    if (titles.length >= n) break;
  }
  return titles;
}

// tier: 'broad' templates test one flat threshold and read generic almost
// by construction (any sufficiently active swiper clears them). 'narrow'
// templates are compound, comparative, or domain-gated — they say
// something a much smaller slice of profiles would actually match. When
// multiple candidates qualify on the same swipe, generateInsightCheck()
// prefers 'narrow' ones so the broad, easy-to-clear templates don't
// dominate every session (see the selection logic below).
const INSIGHT_TEMPLATES = [
  { id: 'wildlife_over_comfort', minEvidence: 3, tier: 'broad',
    text: 'You seem willing to trade some comfort for rare wildlife or photography opportunities.',
    relatedAttributes: ['wildlife', 'photography', 'remoteWilderness', 'rusticAdventure', 'luxury'],
    evidenceAttributes: ['wildlife', 'photography', 'remoteWilderness'],
    test: p => p.wildlife >= 5 && p.comfortFlexibility >= 3 },
  { id: 'crowd_sensitive_insight', minEvidence: 3, tier: 'broad',
    text: 'You seem crowd-sensitive, even when the destination itself is a strong fit.',
    relatedAttributes: ['avoidingCrowds'],
    evidenceAttributes: ['avoidingCrowds'],
    test: p => p.avoidingCrowds >= 6 },
  { id: 'rare_over_sightseeing', minEvidence: 3, tier: 'broad',
    text: 'You seem more motivated by rare encounters than classic sightseeing.',
    relatedAttributes: ['uniqueness', 'famousLandmarks'],
    evidenceAttributes: ['uniqueness'],
    test: p => p.uniqueness >= 9 && p.famousLandmarks <= 0 },
  { id: 'food_wine_bonus', minEvidence: 3, tier: 'broad',
    text: 'Food and wine seem like bonuses for you, not the main reason to choose a trip.',
    relatedAttributes: ['food', 'wine'],
    evidenceAttributes: ['food', 'wine'],
    test: p => (p.food > 0 || p.wine > 0) && p.food < 6 && p.wine < 6 },
  { id: 'sense_of_place', minEvidence: 3, tier: 'broad',
    text: 'You may prefer trips with a strong sense of place over polished resort experiences.',
    relatedAttributes: ['authenticity', 'luxury'],
    evidenceAttributes: ['authenticity'],
    test: p => p.authenticity >= 5 && p.luxury <= 0 },
  { id: 'nature_not_hardship', minEvidence: 3, tier: 'broad',
    text: 'You seem drawn to nature, but not necessarily to hardship for hardship’s sake.',
    relatedAttributes: ['wildlife', 'remoteWilderness', 'rusticAdventure', 'physicalChallenge'],
    evidenceAttributes: ['wildlife', 'remoteWilderness'],
    test: p => (p.wildlife >= 4 || p.remoteWilderness >= 4) && p.rusticAdventure <= 2 && p.physicalChallenge <= 2 },
  { id: 'timing_over_landmarks', minEvidence: 3, tier: 'broad',
    text: 'You appear more interested in timing-sensitive experiences than bucket-list landmarks.',
    relatedAttributes: ['lowSeasonDeals', 'avoidingCrowds', 'famousLandmarks'],
    evidenceAttributes: ['lowSeasonDeals', 'avoidingCrowds'],
    test: p => (p.lowSeasonDeals >= 6 || p.avoidingCrowds >= 6) && p.famousLandmarks <= 0 },
  { id: 'timing_over_luxury', minEvidence: 3, tier: 'broad',
    text: 'Good timing seems to matter more to you than luxury accommodations.',
    relatedAttributes: ['avoidingCrowds', 'lowSeasonDeals', 'luxury'],
    evidenceAttributes: ['avoidingCrowds', 'lowSeasonDeals'],
    test: p => (p.avoidingCrowds >= 6 || p.lowSeasonDeals >= 6) && p.luxury <= 0 },
  { id: 'comfort_flexible_payoff', minEvidence: 3, tier: 'broad',
    text: 'You seem comfort-flexible as long as the payoff feels worth it.',
    relatedAttributes: ['comfortFlexibility', 'wildlife', 'remoteWilderness', 'physicalChallenge'],
    evidenceAttributes: ['comfortFlexibility'],
    test: p => p.comfortFlexibility >= 5 && (p.wildlife >= 4 || p.remoteWilderness >= 4 || p.physicalChallenge >= 4) },
  { id: 'remote_high_reward', minEvidence: 3, tier: 'broad',
    text: 'You seem drawn to remote, high-reward experiences over easily accessible ones.',
    relatedAttributes: ['remoteWilderness', 'uniqueness'],
    evidenceAttributes: ['remoteWilderness', 'uniqueness'],
    test: p => p.remoteWilderness >= 8 && p.uniqueness >= 7 },
  { id: 'warm_water_secondary', minEvidence: 3, tier: 'narrow',
    text: 'Warm water and beach time seem to matter to you, but not enough to carry a whole trip on their own.',
    relatedAttributes: ['beach', 'oceanSwimming'],
    evidenceAttributes: ['beach', 'oceanSwimming'],
    test: p => (p.oceanSwimming > 0 || p.beach > 0)
      && !isTopAttribute(p, 'beach', 5) && !isTopAttribute(p, 'oceanSwimming', 5)
      && (p.beach + p.oceanSwimming) < (p.wildlife + p.remoteWilderness) },
  { id: 'fewer_better_experiences', minEvidence: 3, tier: 'broad',
    text: 'Fewer, better experiences may matter more to you than a packed itinerary.',
    relatedAttributes: ['avoidingCrowds', 'relaxation', 'nightlife', 'shopping'],
    evidenceAttributes: ['avoidingCrowds', 'relaxation'],
    test: p => p.avoidingCrowds >= 5 && p.relaxation >= 3 && p.nightlife <= 1 && p.shopping <= 1 },
  { id: 'thrill_over_calm', minEvidence: 3, tier: 'broad',
    text: 'You seem drawn to adrenaline and physical thrill more than quiet, contemplative moments.',
    relatedAttributes: ['adrenaline', 'physicalChallenge', 'relaxation'],
    evidenceAttributes: ['adrenaline'],
    test: p => p.adrenaline >= 6 && p.relaxation <= 2 },

  // ---- Deeper, subdimension-aware insights (require an unlocked domain) ----
  // These only make sense once there's real depth behind them — a "you like
  // birding" insight before the domain unlocks would be exactly the kind of
  // shallow read the hierarchical model exists to avoid.
  { id: 'rare_target_birder', minEvidence: 3, requiresDomain: 'Birding', tier: 'narrow',
    text: 'You seem interested in birding when it produces rare or photographic encounters, not just casual bird walks.',
    relatedAttributes: ['rareEndemics', 'photography', 'casualBirding'],
    evidenceAttributes: ['rareEndemics', 'photography'],
    test: p => (p.rareEndemics >= 4 || p.photography >= 4) && p.casualBirding <= 1 },
  { id: 'early_morning_payoff', minEvidence: 3, requiresDomain: null, tier: 'narrow',
    text: 'You seem willing to tolerate early mornings if the wildlife or photography payoff is strong.',
    relatedAttributes: ['earlyMorningTolerance', 'wildlife', 'photography'],
    evidenceAttributes: ['earlyMorningTolerance'],
    test: p => p.earlyMorningTolerance >= 4 && (p.wildlife >= 4 || p.photography >= 4) },
  { id: 'ocean_not_passive', minEvidence: 3, requiresDomain: null, tier: 'narrow',
    text: 'You like the ocean, but passive beach time may not be enough to drive a trip on its own.',
    relatedAttributes: ['oceanSwimming', 'beach', 'relaxation'],
    evidenceAttributes: ['oceanSwimming'],
    test: p => p.oceanSwimming >= 4 && p.relaxation <= 1 },
  { id: 'landscape_timing_driver', minEvidence: 3, requiresDomain: 'Landscape Photography', tier: 'narrow',
    text: 'Landscape photography may be a real trip driver for you, especially when timing and light matter.',
    relatedAttributes: ['landscapePhotography', 'goldenHour', 'dramaticWeather'],
    evidenceAttributes: ['landscapePhotography'],
    test: p => p.landscapePhotography >= 6 },
  { id: 'dramatic_not_famous', minEvidence: 3, requiresDomain: 'Landscape Photography', tier: 'narrow',
    text: 'You seem drawn to dramatic landscapes, but not necessarily the most famous viewpoints.',
    relatedAttributes: ['dramaticWeather', 'iconicLandscapes', 'solitude'],
    evidenceAttributes: ['dramaticWeather'],
    test: p => p.dramaticWeather >= 3 && p.iconicLandscapes <= 1 },
  { id: 'rough_conditions_for_access', minEvidence: 3, requiresDomain: null, tier: 'narrow',
    text: 'You may be willing to accept rougher conditions for better access to light, wildlife, or solitude.',
    relatedAttributes: ['comfortFlexibility', 'remoteWilderness', 'solitude'],
    evidenceAttributes: ['comfortFlexibility'],
    test: p => p.comfortFlexibility >= 5 && (p.remoteWilderness >= 4 || p.solitude >= 3) },

  // ---- New: previously-unused subdimension data, now actually feeding
  // Insight Checks instead of only the summary screen. Each one draws a
  // distinction a "you like birding/surfing/cycling/photography" flat read
  // never could.
  { id: 'birding_pelagic_specialist', minEvidence: 3, requiresDomain: 'Birding', tier: 'narrow',
    text: "Rough pelagic trips and hard-to-reach targets don't scare you off — that's a real commitment level, not casual interest.",
    relatedAttributes: ['pelagicBirding', 'difficultTargetChasing'],
    evidenceAttributes: ['pelagicBirding', 'difficultTargetChasing'],
    test: p => p.pelagicBirding >= 3 || p.difficultTargetChasing >= 4 },
  { id: 'birding_casual_addon', minEvidence: 3, requiresDomain: 'Birding', tier: 'narrow',
    text: "Birding reads as a relaxed add-on for you, not something you'd plan a whole trip around.",
    relatedAttributes: ['casualBirding'],
    evidenceAttributes: ['casualBirding'],
    test: p => p.casualBirding >= 3 && p.rareEndemics < 2 },
  { id: 'birding_hide_patience', minEvidence: 3, requiresDomain: 'Birding', tier: 'narrow',
    text: 'Sitting still in a hide for hours to get one shot or sighting genuinely doesn\'t bother you.',
    relatedAttributes: ['birdingFromHides', 'patience'],
    evidenceAttributes: ['birdingFromHides'],
    test: p => p.birdingFromHides >= 3 && p.patience >= 2 },
  { id: 'surf_serious_uncrowded', minEvidence: 3, requiresDomain: 'Surfing', tier: 'narrow',
    text: 'You want serious, uncrowded breaks, not polished beginner-friendly ones.',
    relatedAttributes: ['reefBreaks', 'uncrowded'],
    evidenceAttributes: ['reefBreaks', 'uncrowded'],
    test: p => p.reefBreaks >= 3 || p.uncrowded >= 3 },
  { id: 'surf_warmwater_addon', minEvidence: 3, requiresDomain: 'Surfing', tier: 'narrow',
    text: 'Surfing looks like a warm-water, easygoing part of the trip for you, not the main event.',
    relatedAttributes: ['warmWater', 'seriousSurfIntensity'],
    evidenceAttributes: ['warmWater'],
    test: p => p.warmWater >= 3 && p.seriousSurfIntensity <= 0 },
  { id: 'surf_social_scene', minEvidence: 3, requiresDomain: 'Surfing', tier: 'narrow',
    text: 'The social scene around a surf trip matters to you almost as much as the waves themselves.',
    relatedAttributes: ['surfCamp'],
    evidenceAttributes: ['surfCamp'],
    test: p => p.surfCamp >= 3 },
  { id: 'cycle_challenge_seeker', minEvidence: 3, requiresDomain: 'Cycling', tier: 'narrow',
    text: "You're riding for the physical challenge, not the scenery — climbs and technical terrain are the draw.",
    relatedAttributes: ['hardClimbing', 'mountainBiking'],
    evidenceAttributes: ['hardClimbing', 'mountainBiking'],
    test: p => p.hardClimbing >= 3 || p.mountainBiking >= 3 },
  { id: 'cycle_scenery_first', minEvidence: 3, requiresDomain: 'Cycling', tier: 'narrow',
    // Merged with the near-duplicate 'cycling_scenery_not_performance' —
    // both tested the same axis (scenery over performance) off separate,
    // individually thin attributes ('scenery': 1 card, 'scenicRoadCycling':
    // 2 cards). Combining them widens the evidence pool without loosening
    // what actually has to be true.
    text: 'You want cycling that supports the scenery and the place, not pure athletic performance.',
    relatedAttributes: ['scenicRoadCycling', 'scenery', 'hardClimbing'],
    evidenceAttributes: ['scenicRoadCycling', 'scenery'],
    test: p => (p.scenicRoadCycling >= 3 || p.scenery >= 3) && p.hardClimbing <= 1 },
  { id: 'cycle_comfort_matters', minEvidence: 3, requiresDomain: 'Cycling', tier: 'narrow',
    text: "A comfortable bed and some support at the end of the ride matter to you — this isn't about suffering for its own sake.",
    relatedAttributes: ['luxuryInnToInn', 'supportVehiclePreference'],
    evidenceAttributes: ['luxuryInnToInn', 'supportVehiclePreference'],
    test: p => p.luxuryInnToInn >= 3 || p.supportVehiclePreference >= 2 },
  { id: 'photo_astro_night', minEvidence: 3, requiresDomain: 'Landscape Photography', tier: 'narrow',
    text: 'Night skies and dark-location photography are a real draw for you, not just daytime scenery.',
    relatedAttributes: ['astrophotography', 'lateNightTolerance'],
    evidenceAttributes: ['astrophotography'],
    test: p => p.astrophotography >= 3 },
  { id: 'photo_gear_committed', minEvidence: 3, requiresDomain: 'Landscape Photography', tier: 'narrow',
    text: "You'll haul extra gear or hike well out of the way if it means getting the right shot.",
    relatedAttributes: ['gearHeavy', 'hikingForTheShot'],
    evidenceAttributes: ['gearHeavy', 'hikingForTheShot'],
    test: p => p.gearHeavy >= 3 || p.hikingForTheShot >= 3 },

  // ---- Round 2: user-proposed insights, filtered for what's actually
  // inferable from the current card set (see conversation for the audit
  // of 30 candidates down to these 7 — everything else either duplicated
  // an existing template, relied on data the app doesn't track, or rested
  // on attributes too thin to trust).
  { id: 'mission_driven_travel', minEvidence: 3, requiresDomain: null, tier: 'narrow',
    text: "Trips feel more meaningful to you when there's a specific target — a species, a summit, a shot — not just a destination.",
    relatedAttributes: ['surfAsMainPurpose', 'cyclingAsMainPurpose', 'photoAsMainPurpose', 'difficultTargetChasing'],
    evidenceAttributes: ['surfAsMainPurpose', 'cyclingAsMainPurpose', 'photoAsMainPurpose', 'difficultTargetChasing'],
    test: p => (p.surfAsMainPurpose >= 2 && p.surfAsSideActivity <= 0)
      || (p.cyclingAsMainPurpose >= 2 && p.cyclingAsSideActivity <= 0)
      || (p.photoAsMainPurpose >= 2 && p.photoAsSideActivity <= 0)
      || (p.difficultTargetChasing >= 2 && p.casualBirding <= 0) },
  { id: 'earned_solitude', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: "Quiet feels more valuable to you when it's earned — through effort, remoteness, or good timing — not just handed to you.",
    relatedAttributes: ['physicalChallenge', 'remoteWilderness', 'avoidingCrowds'],
    evidenceAttributes: ['remoteWilderness', 'avoidingCrowds'],
    test: p => (p.physicalChallenge >= 6 || p.remoteWilderness >= 6) && p.avoidingCrowds >= 6 },
  { id: 'selective_immersion', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: 'You seem to want real, local texture — without needing to rough it to get there.',
    relatedAttributes: ['authenticity', 'rusticAdventure', 'physicalChallenge'],
    evidenceAttributes: ['authenticity'],
    test: p => p.authenticity >= 6 && p.rusticAdventure <= 0 && p.physicalChallenge <= 2 },
  { id: 'drawn_to_contrast', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: 'Big swings in pace or setting seem to energize you more than staying in one register the whole trip.',
    relatedAttributes: ['adrenaline', 'relaxation', 'cities', 'remoteWilderness', 'nightlife', 'solitude'],
    evidenceAttributes: ['adrenaline', 'relaxation', 'cities', 'remoteWilderness', 'nightlife', 'solitude'],
    test: p => (p.adrenaline >= 6 && p.relaxation >= 6)
      || (p.cities >= 6 && p.remoteWilderness >= 6)
      || (p.nightlife >= 6 && p.solitude >= 3) },
  { id: 'participation_over_observation', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: 'You seem to remember what you did more than what you saw — doing the thing beats watching it happen.',
    relatedAttributes: ['physicalChallenge', 'adrenaline', 'cycling', 'surfing', 'famousLandmarks', 'photography'],
    evidenceAttributes: ['physicalChallenge', 'adrenaline', 'cycling', 'surfing'],
    test: p => (p.physicalChallenge >= 6 || p.adrenaline >= 6 || p.cycling >= 6 || p.surfing >= 6)
      && p.famousLandmarks <= 0 && p.photography <= 1 },
  { id: 'birding_specialist_expertise', minEvidence: 3, requiresDomain: 'Birding', tier: 'narrow',
    text: 'Access to someone who really knows the birds seems to matter more to you than how nice the lodge is.',
    relatedAttributes: ['specialistGuiding', 'guidedBirding', 'luxury'],
    evidenceAttributes: ['specialistGuiding', 'guidedBirding'],
    test: p => (p.specialistGuiding >= 2 || p.guidedBirding >= 2) && p.luxury <= 0 },
  { id: 'single_dimension_maximizer', minEvidence: 4, requiresDomain: null, tier: 'broad',
    text: "One interest seems to matter a lot more to you than everything else — you'd trade off nearly anything to get more of it.",
    relatedAttributes: ['wildlife', 'birding', 'cycling', 'surfing', 'landscapePhotography', 'food', 'adrenaline', 'culture', 'remoteWilderness', 'cities', 'beach', 'wellness', 'golf', 'snowsports', 'fishing', 'sailing'],
    evidenceAttributes: ['wildlife', 'birding', 'cycling', 'surfing', 'landscapePhotography', 'food', 'adrenaline', 'culture', 'remoteWilderness', 'cities', 'beach', 'wellness', 'golf', 'snowsports', 'fishing', 'sailing'],
    test: p => {
      const headline = ['wildlife', 'birding', 'cycling', 'surfing', 'landscapePhotography', 'food', 'adrenaline', 'culture', 'remoteWilderness', 'cities', 'beach', 'wellness', 'golf', 'snowsports', 'fishing', 'sailing'];
      const vals = headline.map(k => p[k] || 0).filter(v => v > 0).sort((a, b) => b - a);
      if (vals.length < 3) return false;
      return vals[0] >= 10 && vals[0] >= vals[1] * 2;
    } },

  // ---- Round 3: filling gaps the audit surfaced — an unused polarity
  // (food/wine as the driver, not just a bonus), attribute pairs that had
  // never been combined (family+adventure, nightlife+avoidingCrowds,
  // remoteWilderness/wildlife+luxury), and the streetFood/fineDining
  // differentiation from the Priority 2 fix, which had signal on cards but
  // no insight template ever read it.
  { id: 'wild_without_sacrifice', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: 'You want real wildness — but not without a genuinely good bed waiting at the end of the day.',
    relatedAttributes: ['remoteWilderness', 'wildlife', 'luxury'],
    evidenceAttributes: ['remoteWilderness', 'wildlife'],
    test: p => p.remoteWilderness >= 6 && p.wildlife >= 4 && p.luxury >= 6 },
  { id: 'food_wine_as_driver', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: 'Food or wine alone could be reason enough for you to book a trip.',
    relatedAttributes: ['food', 'wine'],
    evidenceAttributes: ['food', 'wine'],
    test: p => p.food >= 8 || p.wine >= 8 },
  { id: 'curated_nightlife', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: 'You want nights that feel curated and alive, not touristy and packed.',
    relatedAttributes: ['nightlife', 'avoidingCrowds'],
    evidenceAttributes: ['nightlife', 'avoidingCrowds'],
    test: p => p.nightlife >= 6 && p.avoidingCrowds >= 6 },
  { id: 'family_adventure', minEvidence: 3, requiresDomain: null, tier: 'broad',
    text: "Adventure doesn't seem to stop just because the kids are along.",
    relatedAttributes: ['family', 'physicalChallenge', 'adrenaline'],
    evidenceAttributes: ['family', 'physicalChallenge', 'adrenaline'],
    test: p => p.family >= 6 && (p.physicalChallenge >= 6 || p.adrenaline >= 6) },
  { id: 'street_food_over_fine_dining', minEvidence: 3, requiresDomain: null, tier: 'narrow',
    text: "You'd rather eat off a cart than sit through a tasting menu.",
    relatedAttributes: ['streetFood', 'fineDining'],
    evidenceAttributes: ['streetFood'],
    test: p => p.streetFood >= 3 && p.fineDining <= 0 },
];

function computeInsightConfidence(profile, template) {
  const relevantSum = template.relatedAttributes.reduce((sum, attr) => sum + Math.max(0, profile[attr] || 0), 0);
  const raw = 0.5 + Math.min(relevantSum / 30, 0.4);
  return Math.round(raw * 100) / 100;
}

/**
 * Turns a template's fixed base claim into the actual sentence shown —
 * grounded in THIS user's data instead of being identical every time the
 * template fires. Two people who both clear the same template's threshold
 * now read different text depending on how hard they cleared it (via the
 * same confidence score already computed above) and what they specifically
 * swiped yes/love on. No AI call, no backend — just assembling real data
 * the app already has into the sentence instead of leaving it generic.
 */
function composeInsightText(template, dnaState, confidence) {
  const tierPhrase = confidence >= 0.8 ? 'a strong, consistent pattern'
    : confidence >= 0.65 ? 'a pattern across several swipes'
    : 'an early read so far';
  const cards = pickEvidenceCardTitles(dnaState, template.evidenceAttributes, 1);
  const evidenceClause = cards.length ? `, e.g. "${cards[0]}"` : '';
  return `${template.text} (${tierPhrase}${evidenceClause})`;
}

/**
 * Returns a new insight object to show, or null if none should be shown
 * right now. Gating rules: no insight checks before 12 swipes, at most one
 * every 6-8 swipes, only when a template's score threshold is met AND it
 * has at least 3 distinct contributing positive swipes behind it, and only
 * for a pattern that hasn't already been shown.
 */
function generateInsightCheck(dnaState) {
  const swipeCount = dnaState.swipeCount || 0;
  if (swipeCount < 12) return null;

  const lastShown = dnaState.lastInsightCheckSwipeCount || 0;
  if (lastShown > 0 && swipeCount - lastShown < 6) return null;

  const alreadyShown = new Set([
    ...(dnaState.confirmedInsights || []),
    ...(dnaState.rejectedInsights || []),
    ...(dnaState.unsureInsights || []),
  ].map(i => i.templateId));

  const candidates = INSIGHT_TEMPLATES.filter(t => {
    if (alreadyShown.has(t.id)) return false;
    if (t.requiresDomain && !isDomainUnlocked(dnaState, t.requiresDomain)) return false;
    if (!t.test(dnaState.profile)) return false;
    const evidence = countPositiveSwipesForAttributes(dnaState, t.evidenceAttributes);
    return evidence >= (t.minEvidence || 3);
  });
  if (!candidates.length) return null;

  // Prefer the narrow/specific candidates over broad ones when both
  // qualify — otherwise the same handful of easy-to-clear generic
  // templates ("you like wildlife," "you're crowd-sensitive") win by
  // default every time, which is exactly what made this feel generic.
  // Not an absolute rule (broad ones still get a turn sometimes) so the
  // deck doesn't feel rigidly gated either.
  const narrow = candidates.filter(t => t.tier === 'narrow');
  const pool = narrow.length && Math.random() < 0.8 ? narrow : candidates;
  const template = pool[Math.floor(Math.random() * pool.length)];
  const confidence = computeInsightConfidence(dnaState.profile, template);
  return {
    id: `${template.id}_${swipeCount}`,
    templateId: template.id,
    text: composeInsightText(template, dnaState, confidence),
    relatedAttributes: template.relatedAttributes,
    evidenceTags: template.evidenceAttributes,
    confidence,
    status: 'pending',
    shownAtSwipeCount: swipeCount,
  };
}

/**
 * Apply the user's thumbs-up/down/unsure response to a pending insight.
 * Confirming nudges related attributes up slightly (independent validation
 * of an existing read, so a small nudge — not a full swipe-equivalent).
 * Rejecting pulls related attributes toward neutral (halves them) rather
 * than flipping them hard negative from a single rejection. "Not sure"
 * changes nothing but is recorded so we don't re-ask the same question.
 */
function applyInsightFeedback(dnaState, insight, feedback) {
  const updated = { ...dnaState };
  const record = { ...insight, status: feedback };
  const profile = { ...dnaState.profile };

  if (feedback === 'confirmed') {
    insight.relatedAttributes.forEach(attr => {
      if ((profile[attr] || 0) >= 0) profile[attr] = (profile[attr] || 0) + 1;
    });
    updated.confirmedInsights = [...(dnaState.confirmedInsights || []), record];
  } else if (feedback === 'rejected') {
    insight.relatedAttributes.forEach(attr => {
      profile[attr] = (profile[attr] || 0) * 0.5;
    });
    updated.rejectedInsights = [...(dnaState.rejectedInsights || []), record];
  } else {
    updated.unsureInsights = [...(dnaState.unsureInsights || []), record];
  }

  updated.profile = profile;
  updated.lastInsightCheckSwipeCount = dnaState.swipeCount;
  updated.pendingInsight = null;
  return updated;
}

// ---- Summary nuance -------------------------------------------------------------
/**
 * Short, specific sentences for the Travel DNA summary's "Nuance we
 * learned" section — the part of the summary that shows DEPTH within a
 * strong domain, not just that the domain is strong. Domain-specific
 * templates only evaluate for domains the user actually unlocked (no
 * point claiming nuance about a domain with no deep signal behind it);
 * general templates apply regardless of domain.
 */
const DOMAIN_NUANCE_TEMPLATES = {
  Birding: [
    { test: p => p.rareEndemics >= 4 || p.photography >= 4, text: "You're target-driven and photography-focused, not a casual walker." },
    { test: p => p.pelagicBirding >= 3, text: 'You want pelagic trips and specialist guiding, not just easy hides.' },
    { test: p => p.casualBirding >= 3 && p.rareEndemics < 2, text: "Birding's a nice add-on for you, not the main reason to travel." },
  ],
  Surfing: [
    { test: p => p.reefBreaks >= 3 || p.uncrowded >= 3, text: 'You want serious, uncrowded breaks over polished beginner spots.' },
    { test: p => p.warmWater >= 3 && p.seriousSurfIntensity <= 0, text: "Surfing's a warm-water, easygoing add-on for you, not the main event." },
    { test: p => p.surfCamp >= 3, text: 'The social scene matters almost as much as the waves.' },
  ],
  Cycling: [
    { test: p => p.hardClimbing >= 3 || p.mountainBiking >= 3, text: 'You ride for the physical challenge, not the scenery.' },
    { test: p => p.scenicRoadCycling >= 3 && p.hardClimbing < 2, text: 'You ride for scenery and place, not pure performance.' },
    { test: p => p.eBikeFriendly >= 3, text: 'You want the views, not the suffering.' },
  ],
  'Landscape Photography': [
    { test: p => p.goldenHour >= 3 || p.dramaticWeather >= 3, text: 'Timing, solitude, and dramatic light drive you most.' },
    { test: p => p.astrophotography >= 3, text: 'Night-sky photography is a real draw, not just daytime scenery.' },
    { test: p => p.iconicLandscapes >= 3 && p.solitude <= 0, text: "You'll brave the crowds for a famous viewpoint." },
  ],
};

const GENERAL_NUANCE_TEMPLATES = [
  { test: p => p.comfortFlexibility >= 5, text: 'Comfort can be flexible for you when the payoff is high.' },
  { test: p => p.luxury <= 1 && p.authenticity >= 4, text: 'Luxury matters less as a standalone motivator than authenticity and access.' },
];

/**
 * The recap shown right after a domain's committed deep-dive question block
 * finishes — "great, here's what we know about you and your preferences for
 * __ on a trip: __". Reuses the same DOMAIN_NUANCE_TEMPLATES as the summary
 * screen's "Nuance we learned" section (so the two stay consistent with each
 * other) but assembles up to 3 matches into one paragraph focused on just
 * this domain. Falls back to a generic-but-honest line in the rare case no
 * template matched yet (an unusual swipe mix within the block).
 */
function generateDomainRecap(domainKey, dnaState) {
  const def = DOMAIN_REGISTRY[domainKey] || {};
  const templates = DOMAIN_NUANCE_TEMPLATES[domainKey] || [];
  const matches = templates.filter(t => t.test(dnaState.profile)).map(t => t.text);
  if (matches.length) return matches.slice(0, 2).join(' ');
  const label = (def.label || domainKey).toLowerCase();
  return `You're clearly into ${label} — we're still zeroing in on your exact style.`;
}

/** Returns an array of nuance sentences: domain-specific first (only for unlocked domains), then general. */
function computeSummaryNuance(dnaState) {
  const lines = [];
  (dnaState.unlockedDomains || []).forEach(domainKey => {
    const templates = DOMAIN_NUANCE_TEMPLATES[domainKey] || [];
    const matches = templates.filter(t => t.test(dnaState.profile)).slice(0, 2);
    matches.forEach(m => lines.push(m.text));
  });
  GENERAL_NUANCE_TEMPLATES.forEach(t => {
    if (t.test(dnaState.profile)) lines.push(t.text);
  });
  return lines;
}

// ---- Converting Travel DNA into destination recommendation weights ----------------
/**
 * The destination app (data.js / app.js) scores places using a different,
 * more concrete vocabulary (27 bookable-activity sliders like "diving" or
 * "winetasting") than Travel DNA's more experiential attribute set (like
 * "uniqueness" or "comfortFlexibility"). This table maps each destination
 * slider to the Travel DNA attributes that predict it, with a weight for
 * how strongly each attribute should count.
 *
 * Some Travel DNA attributes (comfortFlexibility, physicalChallenge's pure
 * form, family) don't map cleanly onto a single destination slider — they
 * matter more to trip *style* than to *which* destination scores well, so
 * they're intentionally left out of this table for now. That's a known
 * simplification, not an oversight — see the app's notes for where a
 * budget/physical "Open To" band integration could pick these up later.
 *
 * golf and snowsports used to have no mapping at all (empty arrays) because
 * there was no card category feeding signal for them. Now that Golf and
 * Snow Sports are real card categories with their own preferenceSignals,
 * they're mapped like everything else.
 */
const SLIDER_ATTRIBUTE_MAP = {
  // birding: rare/pelagic/hide-based signal counts for more than the flat
  // domain score alone — a target-chasing photographic birder should push
  // this higher than a casual-birds-as-part-of-trip signal of equal size.
  birding: [['birding', 0.7], ['rareEndemics', 0.4], ['pelagicBirding', 0.3], ['birdingFromHides', 0.2], ['listing', 0.2], ['casualBirding', -0.2]],
  wildlife: [['wildlife', 1], ['photography', 0.3]],
  hiking: [['hiking', 1], ['physicalChallenge', 0.2], ['hikingForTheShot', 0.2]],
  // scenic and stargazing both pick up landscape-photography subdimensions
  // now that that domain exists — dramatic weather / dark skies / remote
  // mountains are exactly what "scenic" and "stargazing" destinations sell.
  scenic: [['remoteWilderness', 0.5], ['photography', 0.2], ['uniqueness', 0.2], ['landscapePhotography', 0.4], ['dramaticWeather', 0.3], ['mountains', 0.2]],
  stargazing: [['photography', 0.2], ['remoteWilderness', 0.3], ['uniqueness', 0.2], ['astrophotography', 0.5], ['lateNightTolerance', 0.3]],
  // Direct 'fishing' signal now leads (see the fishing cards' own
  // preferenceSignals below) — the old remoteWilderness/rusticAdventure/
  // relaxation weights stay on as smaller secondary texture, not the
  // entire basis for the slider the way they used to be.
  fishing: [['fishing', 0.7], ['remoteWilderness', 0.1], ['relaxation', 0.1]],
  sunbathing: [['beach', 1], ['relaxation', 0.3]],
  swimming: [['oceanSwimming', 1]],
  diving: [['snorkeling', 1]],
  // surfing now has its own primary DNA attribute plus real subdimensions —
  // a beginner/warm-water/comfort-first surf profile should NOT score the
  // same as a reef-break/remote/uncrowded one, even though both "like surfing."
  surfing: [['surfing', 0.6], ['oceanSwimming', 0.15], ['reefBreaks', 0.2], ['warmWater', 0.15], ['adrenaline', 0.1]],
  // sailing now has a direct attribute (see the 3 Sailing & Yachting
  // cards' preferenceSignals below) instead of being entirely proxied.
  sailing: [['sailing', 0.6], ['oceanSwimming', 0.15], ['luxury', 0.15], ['relaxation', 0.1]],
  spa: [['wellness', 1], ['luxury', 0.3], ['relaxation', 0.3]],
  // museums/architecture/festivals each now lead with their own
  // attribute instead of all three sharing 'culture' — loving a museum
  // card and loving a festival card used to be nearly indistinguishable.
  museums: [['museums', 0.6], ['culture', 0.3], ['famousLandmarks', 0.2]],
  architecture: [['architecture', 0.6], ['culture', 0.2], ['famousLandmarks', 0.3], ['cities', 0.1]],
  festivals: [['festivals', 0.6], ['culture', 0.3], ['authenticity', 0.2]],
  // Same fix for fine dining vs. street food, which used to share 'food'.
  finedining: [['fineDining', 0.5], ['food', 0.4], ['luxury', 0.3]],
  streetfood: [['streetFood', 0.5], ['food', 0.4], ['authenticity', 0.3]],
  nightlife: [['nightlife', 1], ['cities', 0.2]],
  winetasting: [['wine', 1]],
  shopping: [['shopping', 1], ['cities', 0.2]],
  // cycling: hard-climbing/mountain-biking travelers want very different
  // destinations than scenic-road/cafe-to-cafe ones, even at equal overall
  // cycling enthusiasm — see the "don't over-rank brutal climbs for a
  // scenic-cafe cyclist" requirement.
  cycling: [['cycling', 0.6], ['hardClimbing', 0.25], ['scenicRoadCycling', 0.25], ['mountainBiking', 0.15], ['innToInn', 0.15], ['comfortAfterEffort', 0.1]],
  // snowsports/golf both now have a direct primary attribute (added
  // alongside the interest picker) on top of the pre-existing proxy
  // signals — so a direct emoji pick drives the slider immediately,
  // without waiting for a swipe pattern to imply it indirectly.
  snowsports: [['snowsports', 0.6], ['physicalChallenge', 0.2], ['avoidingCrowds', 0.1], ['adrenaline', 0.2]],
  adventure: [['rusticAdventure', 0.3], ['physicalChallenge', 0.3], ['adrenaline', 0.35], ['mountainBiking', 0.15]],
  roadtrip: [['remoteWilderness', 0.25], ['authenticity', 0.15], ['adrenaline', 0.15], ['landscapePhotography', 0.3], ['deserts', 0.2], ['roadTrip', 0.2]],
  golf: [['golf', 0.6], ['relaxation', 0.3], ['luxury', 0.2], ['avoidingCrowds', 0.15]],
  deals: [['lowSeasonDeals', 1]],
  crowds: [['avoidingCrowds', 1]],
};

/**
 * Converts a Travel DNA profile into a 0-10 weight per destination slider.
 * Uses min-max normalization across the sliders themselves (not a fixed
 * scale) so the result always spans a meaningful 0-10 range regardless of
 * how many swipes the user has done. A floor of ~2 keeps low-signal sliders
 * from collapsing to a hard 0, which would look like a bug rather than "we
 * don't have much read on this yet".
 */
function convertTravelDNAToRecommendationWeights(profile) {
  const raw = {};
  Object.entries(SLIDER_ATTRIBUTE_MAP).forEach(([sliderKey, attrPairs]) => {
    raw[sliderKey] = attrPairs.reduce((sum, [attr, w]) => sum + w * (profile[attr] || 0), 0);
  });
  const values = Object.values(raw);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  const weights = {};
  Object.entries(raw).forEach(([sliderKey, v]) => {
    const normalized = ((v - min) / range) * 8 + 2; // floor 2, ceiling 10
    weights[sliderKey] = Math.round(Math.max(0, Math.min(10, normalized)));
  });
  return weights;
}

// ---- Persistence ------------------------------------------------------------------
// v2: merged the old separate "trait discovery" pipeline into Insight
// Checks (single confirmable card type), so discoveredTraits is gone —
// confirmedInsights now serves that role too.
const LS_DNA_STATE = 'whereto.traveldna.v2';

function createInitialDNAState() {
  return {
    completedOnboarding: false,
    basicsCompleted: false,
    companions: [], // subset of TRAVEL_COMPANIONS keys
    pickedInterests: [], // subset of INTEREST_EMOJIS keys (interests.js), picked in Step 1
    bands: allBandsSelected(), // same shape as the main app's Open To bands (data.js)
    swipeCount: 0,
    answeredCardIds: [],
    swipes: [], // { cardId, type, timestamp }
    profile: createEmptyPreferenceProfile(),
    calibrationPercent: 0,
    unlockedDomains: [], // domain keys (e.g. 'Birding') whose deep card set has unlocked
    domainUnlockAnnounced: [], // domain keys whose transition card has already been shown
    activeDeepDive: null, // { domain, queue: [cardIds], seenCount, target } — the committed 6-10 question block currently running, if any
    completedDeepDives: [], // domain keys that finished their whole deep-dive question block (badge-worthy)
    pendingDeepDiveDomains: [], // domain keys that unlocked while another deep dive was already running, waiting their turn
    confirmedInsights: [],
    rejectedInsights: [],
    unsureInsights: [],
    lastInsightCheckSwipeCount: 0,
    pendingInsight: null,
    calibrationMilestonesShown: [], // calibration % thresholds (50/70/90/100) whose interstitial has already fired
    dimensionState: createInitialDimensionState(), // raw per-pole accumulators for the 10 competing-tendency dimensions (dimensions.js)
    confirmedTensions: [],
    rejectedTensions: [],
    unsureTensions: [],
    lastTensionCheckSwipeCount: 0,
    pendingTensionCheck: null,
    confirmedDimensionLearnings: [],
    rejectedDimensionLearnings: [],
    unsureDimensionLearnings: [],
    lastLearningCheckSwipeCount: 0,
    pendingLearningCheck: null,
  };
}

function loadDNAState() {
  try {
    const raw = localStorage.getItem(LS_DNA_STATE);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge onto a fresh default so new fields added later don't crash old saves.
      return { ...createInitialDNAState(), ...parsed, profile: { ...createEmptyPreferenceProfile(), ...(parsed.profile || {}) } };
    }
  } catch (e) {}
  return createInitialDNAState();
}

function saveDNAState(dnaState) {
  localStorage.setItem(LS_DNA_STATE, JSON.stringify(dnaState));
}

function resetDNAState() {
  localStorage.removeItem(LS_DNA_STATE);
  return createInitialDNAState();
}

// Added for the Next.js rewrite's test harness (see the import block at
// the top of this file for the corresponding cross-file imports).
export {
  PREFERENCE_ATTRIBUTES, createEmptyPreferenceProfile, SWIPE_WEIGHTS, applySwipeToProfile,
  createInitialDimensionState, applyDimensionSignalsFromSwipe, calculateDimensionConfidence,
  calculateDimensionScores, getStrongestDimensions, getUnresolvedDimensions,
  detectTensions, getStrongestTensions, generateTensionCheck, applyTensionFeedback,
  generateEvidenceForDimension, generateEvidenceForTension, getWhyWeThinkThis, buildEvidenceLine,
  generateLearningObservations, generateStillTestingAreas, generateLearningCheck, applyLearningFeedback,
  sCurve, calculateCalibrationPercent, calculateCategoryDiversity,
  nextUnshownCalibrationMilestone, calibrationStatusText,
  passesBasicsFilters, isCardEligible, getEligibleCards,
  domainSwipeStats, isDomainUnlocked, checkDomainUnlocks,
  buildDeepDiveQueue, startDeepDive, isDeepDiveComplete,
  alignmentScore, categorySwipeStats, chooseNextCard,
  countPositiveSwipesForAttributes, isTopAttribute, pickEvidenceCardTitles,
  INSIGHT_TEMPLATES, computeInsightConfidence, composeInsightText, generateInsightCheck, applyInsightFeedback,
  DOMAIN_NUANCE_TEMPLATES, generateDomainRecap, computeSummaryNuance,
  SLIDER_ATTRIBUTE_MAP, convertTravelDNAToRecommendationWeights,
  createInitialDNAState, loadDNAState, saveDNAState, resetDNAState,
};
