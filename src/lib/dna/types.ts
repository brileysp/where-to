/**
 * Shapes mirror traveldna.js/domains.js/dimensions.js/tensions.js
 * (legacy app at /Users/brendansalant-pearce/Desktop/Claude Code/where-to/).
 *
 * Deliberate deviation from a pure 1:1 port: the legacy engine reads
 * EXPERIENCE_CARDS/DOMAIN_REGISTRY/DIMENSIONS/TENSION_LIBRARY as module-
 * level globals. Since Phase 3 already migrated all of that content into
 * Postgres, these functions take it as explicit typed parameters instead
 * — hardcoding a duplicate copy here would recreate the exact
 * "content lives in two places" problem the migration was for. Every
 * algorithm itself stays byte-for-byte faithful to the legacy source.
 */

export type SwipeType = 'no' | 'yes' | 'love';

export interface DnaCard {
  id: string;
  short: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  preferenceSignals: Record<string, number>;
  dimensionSignals: Record<string, number>;
  stage: 'broad' | 'deep';
  domain: string | null;
  /** See schema.ts's `cards.niche` column doc — discounts this card's "no" swipes from reject-based dimension/tension evidence, nothing else. */
  niche: boolean;
  subdimensions: string[] | null;
  sampleDestinations: string[] | null;
  unlockMinPositive: number | null;
  unlockMinLove: number | null;
  diagnosticPurpose: string | null;
}

export interface DomainDef {
  key: string;
  label: string;
  emoji: string | null;
  matchCategories: string[];
  matchTags: string[];
  hasDeepCards: boolean;
  subdimensions: string[]; // reconstructed from the subdimensions table, ordinal order
  unlockMinPositive: number | null;
  unlockMinLove: number | null;
  transitionTitle: string | null;
  transitionBody: string | null;
}

export interface DimensionDef {
  id: string;
  label: string;
  poleA: string;
  poleB: string;
  keyA: string;
  keyB: string;
  summaryA: string;
  summaryB: string;
  question: string;
}

export interface TensionSignalDef {
  label: string;
  type: 'profile' | 'dimensionPole' | 'rejectedAttrs';
  keys: string[];
  min: number;
  // When `keys` groups a specifically-named thing (e.g. "wildlife") with
  // more general adjacent signals (e.g. "remoteWilderness"), primaryKey
  // requires real evidence on the NAMED thing specifically — the sum
  // across `keys` still counts toward `min`, but evidence/citation only
  // draws from primaryKey so the claim can't be earned (or illustrated)
  // by cards that only ever touched the adjacent signal.
  primaryKey?: string;
}

export interface TensionDef {
  id: string;
  title: string;
  insightText: string;
  recommendationImplication: string | null;
  relatedDimensions: string[];
  signalA: TensionSignalDef;
  signalB: TensionSignalDef;
}

export interface Swipe {
  cardId: string;
  type: SwipeType;
  timestamp: number;
}

export type PreferenceProfile = Record<string, number>;

export interface DimensionState {
  raw: Record<string, number>;
  evidenceCardIds: Record<string, string[]>; // dimension id -> card ids
}

export interface ActiveDeepDive {
  domain: string;
  queue: string[];
  seenCount: number;
  target: number;
  // Names of core axes (see domains.ts) already branched into for this
  // dive, so a resolved axis only rewrites the queue once.
  branchedAxes?: string[];
  // True once this dive has already been given one extra batch of
  // questions for reaching its target with no real nuance/insight earned
  // yet (see maybeExtendDeepDive) — caps it at one extension, not an
  // open-ended chase for a conclusion that may never come.
  extended?: boolean;
}

export interface FeedbackRecord {
  id: string;
  title: string;
  status: 'confirmed' | 'rejected' | 'unsure';
  shownAtSwipeCount: number;
}

export interface DnaBands {
  budget: string[];
  weather: string[];
  vibe: string[];
  physical: string[];
}

// Calibration & Confidence Feedback — a lightweight, one-shot reaction a
// user can give to a specific dimension/tension conclusion shown on the
// Summary screen ("Spot on" / "Sort of" / "Not really" / "Not sure").
// Deliberately separate from FeedbackRecord/Feedback (which drive the
// swipe-flow's Learning Check interstitial) — this is a distinct surface
// with a 4th response ("sort_of") that intentionally leaves dimension/
// tension scoring untouched. See lib/dna/calibration-feedback.ts.
export type CalibrationResponse = 'spot_on' | 'sort_of' | 'not_really' | 'not_sure';

export interface InsightFeedback {
  id: string;
  // 'domain' = a deep-dive recap rating (targetId is the domain key) —
  // unlike dimension/tension, there's no underlying score to bump, so it
  // only ever affects calibrationAdjustment, never applyLearningFeedback.
  targetType: 'dimension' | 'tension' | 'domain';
  targetId: string;
  response: CalibrationResponse;
  timestamp: string;
}

export interface DnaState {
  completedOnboarding: boolean;
  basicsCompleted: boolean;
  companions: string[];
  pickedInterests: string[];
  bands: DnaBands;
  swipeCount: number;
  answeredCardIds: string[];
  swipes: Swipe[];
  profile: PreferenceProfile;
  calibrationPercent: number;
  unlockedDomains: string[];
  domainUnlockAnnounced: string[];
  activeDeepDive: ActiveDeepDive | null;
  completedDeepDives: string[];
  /** Domains whose deep dive finished without earning a real nuance line (see hasEarnedDomainNuance) — their remaining unseen deep cards stay eligible, blended into ordinary swiping, until either a real insight is earned or the domain runs out of cards. */
  unresolvedDeepDomains: string[];
  pendingDeepDiveDomains: string[];
  calibrationMilestonesShown: number[];
  dimensionState: DimensionState;
  confirmedTensions: FeedbackRecord[];
  rejectedTensions: FeedbackRecord[];
  unsureTensions: FeedbackRecord[];
  lastTensionCheckSwipeCount: number;
  pendingTensionCheck: TensionCheck | null;
  confirmedDimensionLearnings: FeedbackRecord[];
  rejectedDimensionLearnings: FeedbackRecord[];
  unsureDimensionLearnings: FeedbackRecord[];
  lastLearningCheckSwipeCount: number;
  pendingLearningCheck: LearningCheck | null;
  insightFeedback: InsightFeedback[];
  /** Cumulative Spot-on/Sort-of/Not-really/Not-sure delta, added on top of the base calibration formula and clamped 0-100 at display time — see computeDisplayCalibrationPercent. */
  calibrationAdjustment: number;
  /** Whether the one-time, non-scoring swipe-gesture tutorial card has already been shown/dismissed. */
  tutorialShown: boolean;
}

export interface DimensionResult {
  id: string;
  label: string;
  poleA: string;
  poleB: string;
  poleAScore: number;
  poleBScore: number;
  leadingPole: string | null;
  confidence: number;
  evidenceCardIds: string[];
  summary: string;
  status: 'strong_signal' | 'moderate_signal' | 'unresolved';
}

export interface TensionSideResult {
  label: string;
  attributes: string[];
  supportingCardIds: string[];
}

export interface TensionResult {
  id: string;
  title: string;
  insightText: string;
  confidence: number;
  signalA: TensionSideResult;
  signalB: TensionSideResult;
  relatedDimensions: string[];
  recommendationImplication: string | null;
  status: 'strong' | 'emerging' | 'confirmed' | 'rejected';
}

export interface TensionCheck {
  id: string;
  tensionId: string;
  tension: TensionResult;
  status: 'pending';
  shownAtSwipeCount: number;
}

export interface LearningCheck {
  id: string;
  kind: 'tension' | 'dimension';
  refId: string; // tensionId or dimensionId
  confidence: number;
  title: string;
  insightText: string;
  evidenceLine: string;
  shownAtSwipeCount: number;
}

export interface Evidence {
  id: string;
  targetType: 'dimension' | 'tension';
  targetId: string;
  confidence: number;
  supportingCardIds: string[];
  opposingCardIds: string[];
  supportingTags: string[];
  opposingTags: string[];
  patternSummary: string;
  loved: string[];
  liked: string[];
}
