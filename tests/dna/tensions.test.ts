import { describe, expect, it } from 'vitest';
import { detectTensions } from '@/lib/dna/tensions';
import { applySwipeToProfile } from '@/lib/dna/profile';
import { applySwipeBothSides, cards, createStatePair, legacy, scriptedSwipeSequence, tensions } from './helpers';
import type { DnaState } from '@/lib/dna/types';

// Deliberate divergence from the legacy engine: `wildlife_plus_comfort`'s
// signalA now carries `primaryKey: 'wildlife'` (see evidence.ts), so its
// supportingCardIds/confidence only draw from cards that actually touch
// `wildlife` — legacy has no such concept and still counts any card
// touching the wider `remoteWilderness` group too. Both results are
// compared with that one tension's result stripped out; its own
// (different, intentional) behavior is asserted separately below.
// Loosely typed: the legacy side comes from an untyped .js import, so this
// needs to accept both engines' result shapes for the comparisons below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withoutWildlifeComfort(results: any[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return results.filter((r: any) => r.id !== 'wildlife_plus_comfort');
}

// Second deliberate divergence: the new engine's evidence-card picker
// (see pickEvidenceCardIds in evidence.ts) now drains Love swipes before
// Yes swipes when choosing which `n` cards to cite, so a genuine Love
// always outranks a merely-more-recent Yes. Legacy is purely recency-
// ordered. Two knock-on effects, both one-directional (the new engine
// can only do better, never worse, than legacy):
//  1. When there are more matching cards than the `n` cap, this can
//     change which cards make the cut, not just their order — so exact
//     supportingCardIds sets are no longer expected to match. Compared
//     by length instead: still proves the same AMOUNT of evidence was
//     found, without asserting on which specific cards represent it.
//  2. A real Love swipe that previously fell outside the recency-capped
//     window (and so was invisible to sideConfidenceContribution's
//     `hasLove` bonus) can now surface inside it — confidence can only
//     go UP as a result, never down. Checked separately below instead
//     of via toEqual.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEvidenceOrder(results: any[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return results.map((r: any) => ({
    ...r,
    confidence: undefined,
    signalA: { ...r.signalA, supportingCardIds: r.signalA.supportingCardIds.length },
    signalB: { ...r.signalB, supportingCardIds: r.signalB.supportingCardIds.length },
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function expectConfidenceNeverDecreased(newResults: any[], legacyResults: any[]) {
  for (const legacyResult of legacyResults) {
    const newResult = newResults.find((r) => r.id === legacyResult.id);
    expect(newResult).toBeDefined();
    expect(newResult.confidence).toBeGreaterThanOrEqual(legacyResult.confidence);
  }
}

describe('detectTensions — exact diff vs legacy engine', () => {
  it('matches legacy tension results after 70 scripted swipes (enough for 2+ evidence per side)', () => {
    let { legacyState, newState } = createStatePair();
    const sequence = scriptedSwipeSequence(70, 5);

    for (const { cardId, swipeType } of sequence) {
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, cardId, swipeType));
    }

    const legacyResults = legacy.detectTensions(legacyState);
    const newResults = detectTensions(newState, cards, tensions);

    expect(normalizeEvidenceOrder(withoutWildlifeComfort(newResults))).toEqual(
      normalizeEvidenceOrder(withoutWildlifeComfort(legacyResults)),
    );
    expectConfidenceNeverDecreased(withoutWildlifeComfort(newResults), withoutWildlifeComfort(legacyResults));
  });

  it('matches with confirmed/rejected tension feedback applied', () => {
    let { legacyState, newState } = createStatePair();
    const sequence = scriptedSwipeSequence(60, 15);
    for (const { cardId, swipeType } of sequence) {
      ({ legacyState, newState } = applySwipeBothSides(legacyState, newState, cardId, swipeType));
    }

    const found = detectTensions(newState, cards, tensions)[0];
    if (found) {
      legacyState = {
        ...legacyState,
        confirmedTensions: [...legacyState.confirmedTensions, { id: found.id, title: found.title, status: 'confirmed', shownAtSwipeCount: legacyState.swipeCount }],
      };
      newState = {
        ...newState,
        confirmedTensions: [...newState.confirmedTensions, { id: found.id, title: found.title, status: 'confirmed', shownAtSwipeCount: newState.swipeCount }],
      };
      const newResults = detectTensions(newState, cards, tensions);
      const legacyResults = legacy.detectTensions(legacyState);
      expect(normalizeEvidenceOrder(withoutWildlifeComfort(newResults))).toEqual(
        normalizeEvidenceOrder(withoutWildlifeComfort(legacyResults)),
      );
      expectConfidenceNeverDecreased(withoutWildlifeComfort(newResults), withoutWildlifeComfort(legacyResults));
    }
  });

  // Reproduces the real "swiped only golf/cycling/adrenaline, got a
  // wildlife insight" bug: adventure/rustic cards carry `remoteWilderness`
  // signal but no `wildlife` signal at all. Before primaryKey, loving
  // enough of them alone was sufficient to claim "Loves wildlife and wild
  // places" and cite those same non-wildlife cards as the reason why.
  it('wildlife_plus_comfort never fires from remoteWilderness-only cards (no real wildlife signal), even with signalB (luxury) fully satisfied', () => {
    let { newState } = createStatePair();
    // adventure_atv/sea_kayak/horseback: remoteWilderness only, no wildlife signal at all — the exact
    // real-content pattern behind "swiped only golf/cycling/adrenaline, got a wildlife insight". Golf
    // cards independently satisfy signalB (luxury), so this proves signalA's primaryKey gate is what's
    // actually blocking the match — not merely signalB being unsatisfied.
    const remoteWildernessOnlyCardIds = ['adventure_atv', 'adventure_sea_kayak', 'adventure_horseback'];
    const luxuryGolfCardIds = ['golf_dawn_round', 'golf_clubhouse_lunch', 'golf_coastal_course'];
    for (const cardId of [...remoteWildernessOnlyCardIds, ...luxuryGolfCardIds]) {
      const card = cards.find((c) => c.id === cardId)!;
      const next: DnaState = {
        ...newState,
        profile: applySwipeToProfile(newState.profile, card, 'love'),
        swipes: [...newState.swipes, { cardId, type: 'love', timestamp: 0 }],
        answeredCardIds: [...newState.answeredCardIds, cardId],
        swipeCount: newState.swipeCount + 1,
      };
      newState = next;
    }
    for (const cardId of remoteWildernessOnlyCardIds) {
      const card = cards.find((c) => c.id === cardId)!;
      expect(card.preferenceSignals.wildlife || 0).toBe(0);
      expect(card.preferenceSignals.remoteWilderness || 0).toBeGreaterThan(0);
    }
    expect(newState.profile.luxury).toBeGreaterThanOrEqual(6); // signalB's own min

    const result = detectTensions(newState, cards, tensions).find((r) => r.id === 'wildlife_plus_comfort');
    expect(result).toBeUndefined();
  });
});
