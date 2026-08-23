/* ---------------------------------------------------------------------
   Where To? — Travel DNA tension library
   -----------------------------------------------------------------
   Pure data, no logic — mirrors dimensions.js's split (data here,
   derivation/scoring in traveldna.js's detectTensions()). A tension is a
   pair of signals that, when BOTH have real independent evidence, point
   at a genuine contradiction in what the user wants (e.g. loves remote
   wildlife AND wants a strong bed at the end of the day) rather than a
   single flat preference.

   Architecture: Cards -> Signals -> Dimensions -> Tensions -> Insights ->
   Recommendations. Tensions sit downstream of both the raw preference
   profile (traveldna.js PREFERENCE_ATTRIBUTES) and the dimension model
   (dimensions.js) — a side can draw evidence from either one, or from
   actual REJECTED swipes on specific card attributes.

   Each signal side has a `type` telling detectTensions() how to evaluate
   it generically, no per-tension code required:
     - 'profile': evidence = positive swipes touching any of `keys`
       (preferenceSignals attribute names), matches when their summed
       positive profile score >= `min`.
     - 'dimensionPole': evidence = positive swipes touching any of `keys`
       (dimensionSignals pole names from dimensions.js), matches when
       their summed raw pole score >= `min`.
     - 'rejectedAttrs': evidence = NO-swipes on cards that positively
       touch any of `keys` (preferenceSignals attributes) — a genuine
       "actively passed on this" signal, used for the "dislikes X" side
       of a tension where no dedicated attribute exists.

   HOW TO ADD A NEW TENSION LATER:
     Add an entry below with a unique id, title, insightText (single
     fixed sentence — a tension needs both sides present to exist at
     all, so there's no "leading pole" framing the way dimensions have),
     recommendationImplication, relatedDimensions (dimensions.js ids,
     for cross-referencing — can be empty), and signalA/signalB. No other
     file needs to change — detectTensions() reads this registry
     generically, same as calculateDimensionScores() reads DIMENSIONS.
--------------------------------------------------------------------- */

const TENSION_LIBRARY = [
  {
    id: 'spontaneity_within_structure', title: 'Spontaneity within structure',
    insightText: 'You seem to like spontaneous, unscheduled moments — but not trips that feel loosely put together.',
    recommendationImplication: 'Recommend trips with strong planning and optional unscripted time.',
    relatedDimensions: ['structure_freedom'],
    signalA: { label: 'Likes open, unscheduled time', type: 'dimensionPole', keys: ['freedom'], min: 6 },
    signalB: { label: 'Wants a solid framework', type: 'dimensionPole', keys: ['structure'], min: 5 },
  },
  {
    id: 'challenge_without_chaos', title: 'Challenge without chaos',
    insightText: 'You enjoy real physical or logistical challenge, but not disorganization.',
    recommendationImplication: 'Recommend demanding trips with excellent guiding and operational quality.',
    relatedDimensions: ['reward_comfort', 'structure_freedom'],
    signalA: { label: 'Accepts effort for a real payoff', type: 'dimensionPole', keys: ['reward'], min: 6 },
    signalB: { label: 'Wants a solid framework', type: 'dimensionPole', keys: ['structure'], min: 5 },
  },
  {
    id: 'authenticity_without_inconvenience', title: 'Authenticity without inconvenience cosplay',
    insightText: 'You value what feels real and local, but not hardship for its own sake.',
    recommendationImplication: 'Recommend real local experiences with enough comfort and quality control.',
    relatedDimensions: ['reward_comfort'],
    signalA: { label: 'Values local, lived-in character', type: 'profile', keys: ['authenticity'], min: 6 },
    signalB: { label: 'Still wants real comfort', type: 'dimensionPole', keys: ['comfort'], min: 5 },
  },
  {
    id: 'wildlife_plus_comfort', title: 'Wildlife plus comfort',
    insightText: 'You may want high-wildlife trips without going fully rugged to get them.',
    recommendationImplication: 'Recommend wildlife-rich trips with good lodges and strong logistics.',
    relatedDimensions: ['reward_comfort'],
    signalA: { label: 'Loves wildlife and wild places', type: 'profile', keys: ['wildlife', 'remoteWilderness'], min: 6, primaryKey: 'wildlife' },
    signalB: { label: 'Wants strong lodging', type: 'profile', keys: ['luxury'], min: 6 },
  },
  {
    id: 'culture_without_homework', title: 'Culture without homework',
    insightText: 'You seem drawn to living culture — markets, food, neighborhoods — more than study-heavy touring.',
    recommendationImplication: 'Recommend neighborhood walks, markets, crafts, and food over dense museums or lecture-style touring.',
    relatedDimensions: [],
    signalA: { label: 'Likes markets, food, neighborhoods', type: 'profile', keys: ['culture', 'authenticity', 'streetFood', 'festivals'], min: 7 },
    signalB: { label: 'Passes on dense, academic touring', type: 'rejectedAttrs', keys: ['museums', 'famousLandmarks', 'architecture'], min: 2 },
  },
  {
    id: 'ocean_active_vs_passive', title: 'Ocean active, not ocean passive',
    insightText: 'The ocean clearly matters to you, but passive beach time alone may not be enough.',
    recommendationImplication: 'Recommend active coastal trips rather than pure beach relaxation.',
    relatedDimensions: ['activity_place'],
    signalA: { label: 'Loves being in the water', type: 'profile', keys: ['oceanSwimming', 'snorkeling'], min: 6 },
    signalB: { label: 'Passes on passive lounging', type: 'rejectedAttrs', keys: ['beach'], min: 2 },
  },
  {
    id: 'luxury_as_support', title: 'Luxury as support, not purpose',
    insightText: 'Luxury seems most valuable to you when it supports access, recovery, or a real experience — not as the point on its own.',
    recommendationImplication: 'Recommend meaningful luxury tied to a real payoff, not generic resort luxury.',
    relatedDimensions: ['reward_comfort', 'expertise_luxury'],
    signalA: { label: 'Wants real comfort', type: 'profile', keys: ['luxury'], min: 5 },
    signalB: { label: 'Also chases a real payoff', type: 'dimensionPole', keys: ['reward'], min: 5 },
  },
  {
    id: 'independent_but_guide_positive', title: 'Independent but guide-positive',
    insightText: 'You may prefer expert input without feeling managed by it.',
    recommendationImplication: 'Recommend trips with optional specialists or guide-led access, but enough autonomy.',
    relatedDimensions: ['structure_freedom', 'expertise_luxury'],
    signalA: { label: 'Likes open, self-directed time', type: 'dimensionPole', keys: ['freedom'], min: 5 },
    signalB: { label: 'Values real expertise', type: 'dimensionPole', keys: ['expertise'], min: 4 },
  },
  {
    id: 'novelty_with_competence', title: 'Novelty with competence',
    insightText: 'You seek novelty and less-obvious places, but still want the trip to feel competently built.',
    recommendationImplication: 'Recommend less obvious destinations run by highly reliable operators.',
    relatedDimensions: ['familiarity_novelty', 'structure_freedom'],
    signalA: { label: 'Drawn to unfamiliar, new places', type: 'dimensionPole', keys: ['novelty'], min: 5 },
    signalB: { label: 'Wants it to feel well-built', type: 'dimensionPole', keys: ['structure', 'certainty'], min: 4 },
  },
  {
    id: 'depth_without_monotony', title: 'Depth without monotony',
    insightText: 'You like going deep on fewer things, but not to the point it feels repetitive.',
    recommendationImplication: 'Recommend focused trips with enough variation to stay engaging.',
    relatedDimensions: ['depth_variety'],
    signalA: { label: 'Prefers going deep over sampling', type: 'dimensionPole', keys: ['depth'], min: 6 },
    signalB: { label: 'Still wants some variety', type: 'dimensionPole', keys: ['variety'], min: 3 },
  },
  {
    id: 'social_but_not_managed', title: 'Social but not group-managed',
    insightText: 'You enjoy social energy when it feels natural — not when it feels choreographed.',
    recommendationImplication: 'Recommend trips with organic social moments, not heavily managed group dynamics.',
    relatedDimensions: ['solitude_social', 'structure_freedom'],
    signalA: { label: 'Likes shared, lively energy', type: 'dimensionPole', keys: ['social'], min: 5 },
    signalB: { label: 'Wants room to opt out', type: 'dimensionPole', keys: ['freedom'], min: 4 },
  },
  {
    id: 'photography_first_but_trip_aware', title: 'Photography-first, but trip-aware',
    insightText: "Photography matters a lot to you, but the rest of the trip still has to hold up.",
    recommendationImplication: 'Recommend photo-rich trips that also deliver on broader destination quality.',
    relatedDimensions: ['activity_place'],
    signalA: { label: 'Photography is a real trip driver', type: 'profile', keys: ['landscapePhotography', 'photography'], min: 6 },
    signalB: { label: 'Cares about the trip beyond the shot', type: 'profile', keys: ['culture', 'wildlife', 'food'], min: 5 },
  },
];

function tensionById(id) {
  return TENSION_LIBRARY.find(t => t.id === id);
}

export { TENSION_LIBRARY, tensionById };
