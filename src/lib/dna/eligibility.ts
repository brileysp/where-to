import type { DnaCard, DnaState } from './types';

// Ported verbatim from traveldna.js:886-956 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/traveldna.js).

/**
 * Hard excludes — not deprioritization, actual removal from the pool —
 * based on what the user said in the Basics step before swiping started.
 * Deliberately conservative: only rules out cards that would feel like an
 * obvious mismatch, not anything the user merely hasn't expressed
 * enthusiasm for yet. Bands left at "everything selected" (no stated
 * preference) never exclude anything. Split out from isCardEligible so a
 * deep card can be tested against these WITHOUT the deep-dive gate (used
 * when building a deep-dive's question queue).
 */
export function passesBasicsFilters(card: DnaCard, dnaState: DnaState): boolean {
  const companions = dnaState.companions || [];
  const bands = dnaState.bands;
  const signals = card.preferenceSignals || {};

  // Companions: skip family-oriented moments for travelers who never
  // mentioned kids.
  if (!companions.includes('kids') && card.category === 'Family') return false;

  // Budget & Comfort.
  const budget = bands.budget || [];
  const excludesBasic = budget.length > 0 && !budget.includes('basic');
  const wantsOnlyLuxury = excludesBasic && !budget.includes('comfortable');
  const wantsOnlyBudget = budget.length > 0 && !budget.includes('highend') && !budget.includes('luxury');
  if (excludesBasic && card.category === 'Rustic Adventure') return false;
  if (wantsOnlyLuxury && (signals.luxury || 0) <= -1) return false;
  if (wantsOnlyBudget && (signals.luxury || 0) >= 3) return false;

  // Physical Demand.
  const physical = bands.physical || [];
  const easyOnly = physical.length === 1 && physical.includes('easy');
  const excludesDemanding = physical.length > 0 && !physical.includes('active') && !physical.includes('challenging');
  if (easyOnly && (signals.physicalChallenge || 0) >= 2) return false;
  if (excludesDemanding && (signals.physicalChallenge || 0) >= 3) return false;

  // Social Vibe.
  const vibe = bands.vibe || [];
  const wantsQuietOnly = vibe.length > 0 && !vibe.includes('lively') && !vibe.includes('highenergy');
  if (wantsQuietOnly && (signals.nightlife || 0) >= 3) return false;

  // Weather isn't used to exclude cards — cards aren't tagged with a
  // temperature.
  return true;
}

/**
 * Deep cards are invisible except during their own domain's committed
 * deep-dive block — a deep card is only eligible while
 * dnaState.activeDeepDive is running for that exact domain AND the card
 * is one of the cards chosen for that specific block. Once the block
 * ends, activeDeepDive clears and every deep card in that domain goes
 * back to ineligible — UNLESS the domain finished without earning a real
 * insight (dnaState.unresolvedDeepDomains, set in OnboardingFlow when a
 * dive completes with nothing to show for it), in which case its
 * remaining unseen deep cards stay eligible, now blended into ordinary
 * swiping rather than a forced block, until a real insight is earned or
 * the domain runs out of cards (see resolveUnresolvedDomains).
 */
export function isCardEligible(card: DnaCard, dnaState: DnaState): boolean {
  if (card.stage === 'deep') {
    const dive = dnaState.activeDeepDive;
    const inActiveDive = !!dive && dive.domain === card.domain && dive.queue.includes(card.id);
    const domainStillUnresolved = !!card.domain && (dnaState.unresolvedDeepDomains || []).includes(card.domain);
    if (!inActiveDive && !domainStillUnresolved) return false;
  }
  return passesBasicsFilters(card, dnaState);
}

export function getEligibleCards(dnaState: DnaState, allCards: DnaCard[]): DnaCard[] {
  return allCards.filter((c) => isCardEligible(c, dnaState));
}
