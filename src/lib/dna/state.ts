import { createEmptyPreferenceProfile } from './profile';
import { createInitialDimensionState } from './dimensions';
import { allBandsSelected } from '@/lib/scoring/constants';
import type { DimensionDef, DnaState } from './types';

// Ported from traveldna.js:1922-1984 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/traveldna.js).
//
// Phase 4 scope: in-memory only, driven by React state — no
// localStorage, no Postgres. loadDNAState/saveDNAState become server
// actions writing user_dna_state in Phase 5; this function (the shape of
// a fresh state) carries over unchanged either way.

export function createInitialDNAState(dimensions: DimensionDef[]): DnaState {
  return {
    completedOnboarding: false,
    basicsCompleted: false,
    companions: [],
    pickedInterests: [],
    bands: allBandsSelected() as unknown as DnaState['bands'],
    swipeCount: 0,
    answeredCardIds: [],
    swipes: [],
    profile: createEmptyPreferenceProfile(),
    calibrationPercent: 0,
    unlockedDomains: [],
    domainUnlockAnnounced: [],
    activeDeepDive: null,
    completedDeepDives: [],
    unresolvedDeepDomains: [],
    pendingDeepDiveDomains: [],
    calibrationMilestonesShown: [],
    dimensionState: createInitialDimensionState(dimensions),
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
    insightFeedback: [],
    calibrationAdjustment: 0,
    tutorialShown: false,
  };
}
