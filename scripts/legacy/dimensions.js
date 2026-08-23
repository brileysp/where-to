/* ---------------------------------------------------------------------
   Where To? — Travel DNA dimension registry
   -----------------------------------------------------------------
   This is a SEPARATE model from the attribute profile in traveldna.js
   (PREFERENCE_ATTRIBUTES / dnaState.profile). That system asks "how much
   does this person like X" per attribute. This one asks a different
   question: "where does this person sit between two competing travel
   tendencies" — Depth vs Variety, Reward vs Comfort, and so on.

   Architecture (cards -> signals -> dimensions -> tensions -> insights):
     - Cards optionally carry a `dimensionSignals` object (see cards.js),
       separate from `preferenceSignals`. A signal is keyed by POLE, not
       by dimension id — e.g. a card can push `depth` up and `variety`
       down at once, or push only one pole and leave the other untouched.
     - applyDimensionSignalsFromSwipe() (traveldna.js) accumulates those
       raw per-pole scores onto dnaState.dimensionState as the user swipes.
     - calculateDimensionScores() (traveldna.js) derives the DISPLAY model
       (0-100 split, leadingPole, confidence, status, summary text) from
       those raw accumulators, on demand — nothing about the display shape
       is stored, only the raw per-pole totals + evidence card ids.

   IMPORTANT — no simplistic inversion: a card's dimensionSignals should
   only include a pole if the card's content genuinely speaks to that pole.
   Rejecting a card that signals `variety: 2` pushes the variety
   accumulator down (a real "no" to variety) — it does NOT automatically
   credit `depth` unless the card's own metadata also included a depth
   value. Nuance lives in the card data, not in a blanket flip rule.

   HOW TO ADD A NEW DIMENSION LATER:
     1. Add an entry below with a unique id, label, poleA/poleB display
        names, keyA/keyB (the dimensionSignals property names cards will
        use), and summaryA/summaryB copy (shown depending on which pole
        leads).
     2. Start tagging relevant cards with `dimensionSignals: { keyA: n }`
        / `{ keyB: n }` in cards.js. No other file needs to change —
        calculateDimensionScores() reads this registry generically.
--------------------------------------------------------------------- */

const DIMENSIONS = [
  {
    id: 'depth_variety', label: 'Depth vs Variety',
    poleA: 'Depth', poleB: 'Variety', keyA: 'depth', keyB: 'variety',
    summaryA: 'You seem to get more from going deep on fewer things than sampling widely.',
    summaryB: 'Sampling a range of different experiences seems to matter more to you than settling into one.',
    question: 'Do you prefer going deep on fewer things, or sampling widely?',
  },
  {
    id: 'reward_comfort', label: 'Reward vs Comfort',
    poleA: 'Reward', poleB: 'Comfort', keyA: 'reward', keyB: 'comfort',
    summaryA: "You'll trade some comfort when the payoff feels worth it.",
    summaryB: 'Smooth logistics and real comfort seem to matter more than chasing a bigger payoff.',
    question: 'Will you trade comfort for the right payoff, or does comfort come first?',
  },
  {
    id: 'timing_prestige', label: 'Timing vs Prestige',
    poleA: 'Timing', poleB: 'Prestige', keyA: 'timing', keyB: 'prestige',
    summaryA: 'The right conditions may matter more to you than the famous name.',
    summaryB: 'Well-known, bucket-list stops seem to carry real weight for you.',
    question: 'Does perfect timing matter more to you than a famous name?',
  },
  {
    id: 'structure_freedom', label: 'Structure vs Freedom',
    poleA: 'Structure', poleB: 'Freedom', keyA: 'structure', keyB: 'freedom',
    summaryA: 'A clear plan and known logistics seem to matter more to you than staying open-ended.',
    summaryB: 'Open time and room to improvise seem to matter more than a locked itinerary.',
    question: 'Do you want a clear plan, or open, unscripted time?',
  },
  {
    id: 'activity_place', label: 'Activity vs Place',
    poleA: 'Activity', poleB: 'Place', keyA: 'activity', keyB: 'place',
    summaryA: 'What you’re doing seems to matter more than where you’re doing it.',
    summaryB: 'The atmosphere and character of a destination seem to matter more than any single activity.',
    question: 'Is it what you do that matters most, or where you are?',
  },
  {
    id: 'expertise_luxury', label: 'Expertise vs Luxury',
    poleA: 'Expertise', poleB: 'Luxury', keyA: 'expertise', keyB: 'luxury',
    summaryA: 'Access to real expertise and local knowledge seems to matter more than premium comfort.',
    summaryB: 'Comfort, design, and service seem to matter more than specialist access.',
    question: 'Do you value expert access more than premium comfort?',
  },
  {
    id: 'solitude_social', label: 'Solitude vs Social Energy',
    poleA: 'Solitude', poleB: 'Social Energy', keyA: 'solitude', keyB: 'social',
    summaryA: 'Quiet and low crowds seem to matter more to you than energy and company.',
    summaryB: 'Shared energy and people around you seem to matter more than quiet solitude.',
    question: 'Does solitude matter more to you than shared energy?',
  },
  {
    id: 'certainty_possibility', label: 'Certainty vs Possibility',
    poleA: 'Certainty', poleB: 'Possibility', keyA: 'certainty', keyB: 'possibility',
    summaryA: 'A reliable, predictable payoff seems to matter more to you than chasing a long shot.',
    summaryB: 'You seem willing to accept real uncertainty for a shot at something exceptional.',
    question: 'Do you want a reliable payoff, or a shot at something exceptional?',
  },
  {
    id: 'familiarity_novelty', label: 'Familiarity vs Novelty',
    poleA: 'Familiarity', poleB: 'Novelty', keyA: 'familiarity', keyB: 'novelty',
    summaryA: 'Returning to known favorites seems to matter more to you than chasing something new.',
    summaryB: 'New, unfamiliar settings seem to matter more to you than returning to what you know.',
    question: 'Do you return to favorites, or chase something new?',
  },
  {
    id: 'relaxation_pursuit', label: 'Relaxation vs Pursuit',
    poleA: 'Relaxation', poleB: 'Pursuit', keyA: 'relaxation', keyB: 'pursuit',
    summaryA: 'Rest and an open agenda seem to matter more to you than actively working toward something.',
    summaryB: 'Having a goal or target to chase seems to matter more to you than simply resting.',
    question: 'Is rest the goal, or is having something to chase?',
  },
];

function dimensionById(id) {
  return DIMENSIONS.find(d => d.id === id);
}

export { DIMENSIONS, dimensionById };
