import { dimensionPoleSideEvidence, generateEvidenceForTension, profileSideEvidence, rejectedAttrsSideEvidence, buildEvidenceLine } from './evidence';
import type { DnaCard, DnaState, FeedbackRecord, TensionCheck, TensionDef, TensionResult } from './types';

// Ported verbatim from traveldna.js:366-491 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/traveldna.js).

interface SideEvidence {
  matches: boolean;
  count: number;
  hasLove: boolean;
  supportingCardIds: string[];
}

function evaluateTensionSide(
  dnaState: DnaState,
  allCards: DnaCard[],
  side: TensionDef['signalA'],
): SideEvidence {
  const primaryKeys = side.primaryKey ? [side.primaryKey] : undefined;
  if (side.type === 'profile') return profileSideEvidence(dnaState, allCards, side.keys, side.min, primaryKeys);
  if (side.type === 'dimensionPole') return dimensionPoleSideEvidence(dnaState, allCards, side.keys, side.min, primaryKeys);
  if (side.type === 'rejectedAttrs') return rejectedAttrsSideEvidence(dnaState, allCards, side.keys, side.min);
  return { matches: false, count: 0, hasLove: false, supportingCardIds: [] };
}

function sideConfidenceContribution(ev: SideEvidence): number {
  return Math.min(1, ev.count / 4) * 0.7 + (ev.hasLove ? 0.3 : 0);
}

/**
 * Runs the full tension library against current state and returns the
 * results that have real evidence on BOTH sides — a tension with only
 * one side supported isn't returned at all. Confirmed/rejected user
 * feedback overrides the computed status.
 */
export function detectTensions(dnaState: DnaState, allCards: DnaCard[], tensions: TensionDef[]): TensionResult[] {
  const confirmed = new Set((dnaState.confirmedTensions || []).map((t) => t.id));
  const rejected = new Set((dnaState.rejectedTensions || []).map((t) => t.id));

  const results: TensionResult[] = [];
  for (const def of tensions) {
    const evA = evaluateTensionSide(dnaState, allCards, def.signalA);
    const evB = evaluateTensionSide(dnaState, allCards, def.signalB);
    // Requires at least 2 distinct supporting cards on EACH side.
    if (evA.count < 2 || evB.count < 2) continue;

    let confidence = Math.round(((sideConfidenceContribution(evA) + sideConfidenceContribution(evB)) / 2) * 100) / 100;
    confidence = Math.min(1, confidence);

    let status: TensionResult['status'] = confidence >= 0.6 ? 'strong' : 'emerging';
    if (confirmed.has(def.id)) status = 'confirmed';
    else if (rejected.has(def.id)) status = 'rejected';

    results.push({
      id: def.id,
      title: def.title,
      insightText: def.insightText,
      confidence,
      signalA: { label: def.signalA.label, attributes: def.signalA.keys, supportingCardIds: evA.supportingCardIds },
      signalB: { label: def.signalB.label, attributes: def.signalB.keys, supportingCardIds: evB.supportingCardIds },
      relatedDimensions: def.relatedDimensions,
      recommendationImplication: def.recommendationImplication,
      status,
    });
  }
  return results;
}

/** Curated top N for the summary — strong or user-confirmed only, never 'emerging', never 'rejected'. */
export function getStrongestTensions(
  dnaState: DnaState,
  allCards: DnaCard[],
  tensions: TensionDef[],
  n = 4,
): TensionResult[] {
  return detectTensions(dnaState, allCards, tensions)
    .filter((t) => t.status === 'strong' || t.status === 'confirmed')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, n);
}

/**
 * Offers a tension for confirmation once it reaches medium confidence
 * (0.5). Same shown-once + cooldown-gap pattern as generateInsightCheck.
 */
export function generateTensionCheck(dnaState: DnaState, allCards: DnaCard[], tensions: TensionDef[]): TensionCheck | null {
  const swipeCount = dnaState.swipeCount || 0;
  if (swipeCount < 12) return null;

  const lastShown = dnaState.lastTensionCheckSwipeCount || 0;
  if (lastShown > 0 && swipeCount - lastShown < 6) return null;

  const alreadyShown = new Set(
    [...(dnaState.confirmedTensions || []), ...(dnaState.rejectedTensions || []), ...(dnaState.unsureTensions || [])].map(
      (t) => t.id,
    ),
  );

  const candidates = detectTensions(dnaState, allCards, tensions).filter(
    (t) => !alreadyShown.has(t.id) && t.confidence >= 0.5,
  );
  if (!candidates.length) return null;

  candidates.sort((a, b) => b.confidence - a.confidence);
  const tension = candidates[0];
  return { id: `${tension.id}_${swipeCount}`, tensionId: tension.id, tension, status: 'pending', shownAtSwipeCount: swipeCount };
}

type Feedback = 'confirmed' | 'rejected' | 'unsure';

/**
 * Confirm = strengthen (bumps raw dimension poles / profile attributes
 * behind both sides, +1). Reject = weaken (halves them). The tension is
 * recorded as rejected, permanently excluding it from prominent display.
 * Unsure changes nothing but leaves it eligible to be asked again.
 */
export function applyTensionFeedback(
  dnaState: DnaState,
  tensionCheck: { tensionId: string; tension: { title: string }; shownAtSwipeCount: number },
  feedback: Feedback,
  tensions: TensionDef[],
): DnaState {
  const updated: DnaState = { ...dnaState };
  const def = tensions.find((t) => t.id === tensionCheck.tensionId);
  const record: FeedbackRecord = {
    id: tensionCheck.tensionId,
    title: tensionCheck.tension.title,
    status: feedback,
    shownAtSwipeCount: tensionCheck.shownAtSwipeCount,
  };

  if (def && (feedback === 'confirmed' || feedback === 'rejected')) {
    const bumpOp = feedback === 'confirmed' ? (v: number) => v + 1 : (v: number) => v * 0.5;
    [def.signalA, def.signalB].forEach((side) => {
      if (side.type === 'profile') {
        const profile = { ...updated.profile };
        side.keys.forEach((k) => {
          if ((profile[k] || 0) >= 0) profile[k] = bumpOp(profile[k] || 0);
        });
        updated.profile = profile;
      } else if (side.type === 'dimensionPole') {
        const base = updated.dimensionState || dnaState.dimensionState;
        const dimState = { raw: { ...base.raw }, evidenceCardIds: { ...base.evidenceCardIds } };
        side.keys.forEach((k) => {
          if ((dimState.raw[k] || 0) >= 0) dimState.raw[k] = bumpOp(dimState.raw[k] || 0);
        });
        updated.dimensionState = dimState;
      }
      // 'rejectedAttrs' sides aren't bumped.
    });
  }

  if (feedback === 'confirmed') updated.confirmedTensions = [...(dnaState.confirmedTensions || []), record];
  else if (feedback === 'rejected') updated.rejectedTensions = [...(dnaState.rejectedTensions || []), record];
  else updated.unsureTensions = [...(dnaState.unsureTensions || []), record];

  updated.lastTensionCheckSwipeCount = dnaState.swipeCount;
  return updated;
}

export { generateEvidenceForTension, buildEvidenceLine };
