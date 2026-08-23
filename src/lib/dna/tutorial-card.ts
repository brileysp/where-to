import type { DnaCard } from './types';

// A one-time, non-scoring pseudo-card shown as the very first card in the
// deck for a brand-new user, teaching the swipe gestures by having them
// actually perform one. Never enters profile/dimensionState/swipeCount —
// OnboardingFlow's handleSwipe special-cases this id and just marks
// tutorialShown instead of running the normal scoring cascade.
export const TUTORIAL_CARD_ID = '__tutorial__';

export const TUTORIAL_CARD: DnaCard = {
  id: TUTORIAL_CARD_ID,
  short: 'how this works',
  title: "Here's how swiping works",
  description: "Swipe left if it's not for you, right if you like it, up if you love it. Try any direction now to continue.",
  category: 'Welcome',
  tags: ['← Not for me', '→ Like it', '↑ Love it'],
  preferenceSignals: {},
  dimensionSignals: {},
  stage: 'broad',
  domain: null,
  niche: false,
  subdimensions: null,
  sampleDestinations: null,
  unlockMinPositive: null,
  unlockMinLove: null,
  diagnosticPurpose: null,
};
