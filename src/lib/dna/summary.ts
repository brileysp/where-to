import { calculateDimensionScores } from './dimensions';
import { detectTensions, applyTensionFeedback, generateEvidenceForTension, buildEvidenceLine } from './tensions';
import { domainSwipeStats } from './domains';
import { generateEvidenceForDimension } from './evidence';
import type {
  DimensionDef,
  DnaCard,
  DnaState,
  DomainDef,
  FeedbackRecord,
  LearningCheck,
  TensionDef,
} from './types';

// Ported verbatim from traveldna.js:607-748 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/traveldna.js).

interface SummaryPoolItem {
  kind: 'dimension' | 'tension';
  id: string;
  confidence: number;
  text: string;
}

export function rankSummaryItems<T extends { confidence: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.confidence - a.confidence);
}

/**
 * Removes summary-item candidates that would repeat something already
 * shown elsewhere: anything in the exclude lists, plus any leftover
 * DIMENSION whose id is referenced by a leftover TENSION's
 * relatedDimensions — the tension is the more specific idea, so it wins.
 */
export function dedupeOverlappingSummaryItems(
  pool: SummaryPoolItem[],
  excludeDimIds: string[],
  excludeTensionIds: string[],
  tensions: TensionDef[],
): SummaryPoolItem[] {
  const dimIdsCoveredByTensions = new Set(
    pool
      .filter((i) => i.kind === 'tension')
      .flatMap((i) => tensions.find((t) => t.id === i.id)?.relatedDimensions || []),
  );
  return pool.filter((item) => {
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
 * that didn't make the top-5/top-4 headline cut.
 */
export function generateLearningObservations(
  dnaState: DnaState,
  allCards: DnaCard[],
  dimensions: DimensionDef[],
  tensions: TensionDef[],
  excludeDimIds: string[],
  excludeTensionIds: string[],
  n = 3,
): SummaryPoolItem[] {
  const allDims = calculateDimensionScores(dnaState, dimensions).filter((d) => d.status !== 'unresolved');
  const allTensions = detectTensions(dnaState, allCards, tensions).filter(
    (t) => t.status === 'strong' || t.status === 'confirmed',
  );
  const pool: SummaryPoolItem[] = [
    ...allDims.map((d) => ({ kind: 'dimension' as const, id: d.id, confidence: d.confidence, text: d.summary })),
    ...allTensions.map((t) => ({ kind: 'tension' as const, id: t.id, confidence: t.confidence, text: t.insightText })),
  ];
  const deduped = dedupeOverlappingSummaryItems(pool, excludeDimIds, excludeTensionIds, tensions);
  return rankSummaryItems(deduped).slice(0, n);
}

/**
 * "Still testing" — genuinely unresolved questions, from three places:
 * dimensions with too little evidence, tensions with partial (not
 * 'strong') evidence, and domains where swipes have gone both ways often
 * enough that neither reading is safe yet.
 */
export function generateStillTestingAreas(
  dnaState: DnaState,
  allCards: DnaCard[],
  dimensions: DimensionDef[],
  tensions: TensionDef[],
  domains: DomainDef[],
  n = 5,
): string[] {
  const unresolvedDims = calculateDimensionScores(dnaState, dimensions).filter((d) => d.status === 'unresolved');
  const emergingTensions = detectTensions(dnaState, allCards, tensions).filter((t) => t.status === 'emerging');
  const stats = domainSwipeStats(dnaState, allCards, domains);

  const pool = [
    ...unresolvedDims.map((d) => ({
      text: dimensions.find((def) => def.id === d.id)!.question,
      evidenceCount: d.evidenceCardIds.length,
    })),
    ...emergingTensions.map((t) => ({
      text: `${t.signalA.label}, or ${t.signalB.label.toLowerCase()}?`,
      evidenceCount: t.signalA.supportingCardIds.length + t.signalB.supportingCardIds.length,
    })),
    ...Object.entries(stats)
      .filter(([, s]) => s.seen >= 4 && s.positive >= 2 && s.negative >= 2)
      .map(([domain, s]) => ({
        text: `Is ${domain} a real trip driver for you, or a nice-to-have?`,
        evidenceCount: s.positive + s.negative,
      })),
  ];

  return pool
    .sort((a, b) => b.evidenceCount - a.evidenceCount)
    .slice(0, n)
    .map((p) => p.text);
}

// A candidate with a real rejection behind it (a genuine "no" on
// something representing the other side) can fire at the normal bar — an
// earned "you like X but not Y" is worth surfacing as soon as it's real.
// A candidate with ONLY positive evidence has to clear a meaningfully
// higher bar first: rather than settling for a weaker "especially X"
// claim the moment some threshold is crossed, this makes the check wait
// for more swipes first, giving a real contrastive pairing more of a
// chance to show up naturally. If it never does, the higher bar still
// gets crossed eventually and the additive version fires — additive is
// the honest fallback, not the app's default voice.
const CONTRAST_MIN_CONFIDENCE = 0.5;
const NO_CONTRAST_MIN_CONFIDENCE = 0.7;

interface LearningCheckCandidate {
  kind: 'tension' | 'dimension';
  id: string;
  confidence: number;
  title: string;
  insightText: string;
  evidenceLine: string;
  hasContrast: boolean;
}

/**
 * Unified confirmation flow for BOTH tensions and dimension-derived
 * learning observations — one candidate pool, one cooldown, so at most
 * one confirmable card ever interrupts a swipe.
 */
export function generateLearningCheck(
  dnaState: DnaState,
  allCards: DnaCard[],
  dimensions: DimensionDef[],
  tensions: TensionDef[],
): LearningCheck | null {
  const swipeCount = dnaState.swipeCount || 0;
  if (swipeCount < 12) return null;

  const lastShown = dnaState.lastLearningCheckSwipeCount || 0;
  if (lastShown > 0 && swipeCount - lastShown < 6) return null;

  const shownTensionIds = new Set(
    [...(dnaState.confirmedTensions || []), ...(dnaState.rejectedTensions || []), ...(dnaState.unsureTensions || [])].map(
      (t) => t.id,
    ),
  );
  const shownDimIds = new Set(
    [
      ...(dnaState.confirmedDimensionLearnings || []),
      ...(dnaState.rejectedDimensionLearnings || []),
      ...(dnaState.unsureDimensionLearnings || []),
    ].map((d) => d.id),
  );

  const tensionCandidates: LearningCheckCandidate[] = detectTensions(dnaState, allCards, tensions)
    .filter((t) => !shownTensionIds.has(t.id))
    .map((t) => {
      const evidence = generateEvidenceForTension(dnaState, allCards, t, tensions);
      return {
        kind: 'tension' as const,
        id: t.id,
        confidence: t.confidence,
        title: t.title,
        insightText: t.insightText,
        evidenceLine: buildEvidenceLine(evidence, allCards),
        hasContrast: (evidence?.opposingCardIds.length ?? 0) > 0,
      };
    })
    .filter((c) => c.confidence >= (c.hasContrast ? CONTRAST_MIN_CONFIDENCE : NO_CONTRAST_MIN_CONFIDENCE));

  const dimCandidates: LearningCheckCandidate[] = calculateDimensionScores(dnaState, dimensions)
    .filter((d) => !shownDimIds.has(d.id) && d.status !== 'unresolved')
    .map((d) => {
      const evidence = generateEvidenceForDimension(dnaState, allCards, d, dimensions);
      return {
        kind: 'dimension' as const,
        id: d.id,
        confidence: d.confidence,
        title: d.label,
        insightText: d.summary,
        evidenceLine: buildEvidenceLine(evidence, allCards),
        hasContrast: (evidence?.opposingCardIds.length ?? 0) > 0,
      };
    })
    .filter((c) => c.confidence >= (c.hasContrast ? CONTRAST_MIN_CONFIDENCE : NO_CONTRAST_MIN_CONFIDENCE));

  const all = [...tensionCandidates, ...dimCandidates];
  if (!all.length) return null;

  // Real contrastive pairings always win over additive-only ones, even
  // over a higher raw confidence number — an earned "but not Y" beats a
  // merely-more-confident "and Y too".
  const contrastCandidates = all.filter((c) => c.hasContrast);
  const pool = contrastCandidates.length ? contrastCandidates : all;
  const chosen = [...pool].sort((a, b) => b.confidence - a.confidence)[0];

  return {
    id: `${chosen.kind}_${chosen.id}_${swipeCount}`,
    kind: chosen.kind,
    refId: chosen.id,
    confidence: chosen.confidence,
    title: chosen.title,
    insightText: chosen.insightText,
    evidenceLine: chosen.evidenceLine,
    shownAtSwipeCount: swipeCount,
  };
}

export type Feedback = 'confirmed' | 'rejected' | 'unsure';

/**
 * Confirm = strengthen, reject = weaken, unsure = leave as still-testing.
 * Tension-kind checks delegate to applyTensionFeedback; dimension-kind
 * checks bump the leading pole's raw score the same way.
 */
export function applyLearningFeedback(
  dnaState: DnaState,
  check: LearningCheck,
  feedback: Feedback,
  dimensions: DimensionDef[],
  tensions: TensionDef[],
): DnaState {
  if (check.kind === 'tension') {
    const tensionCheckShape = {
      tensionId: check.refId,
      tension: { title: check.title },
      shownAtSwipeCount: check.shownAtSwipeCount,
    };
    const updated = applyTensionFeedback(dnaState, tensionCheckShape, feedback, tensions);
    updated.lastLearningCheckSwipeCount = dnaState.swipeCount;
    return updated;
  }

  const updated: DnaState = { ...dnaState };
  const def = dimensions.find((d) => d.id === check.refId);
  const record: FeedbackRecord = {
    id: check.refId,
    title: check.title,
    status: feedback,
    shownAtSwipeCount: check.shownAtSwipeCount,
  };

  if (def && (feedback === 'confirmed' || feedback === 'rejected')) {
    const bumpOp = feedback === 'confirmed' ? (v: number) => v + 1 : (v: number) => v * 0.5;
    const dimScore = calculateDimensionScores(dnaState, dimensions).find((d) => d.id === check.refId);
    const leadingKey = dimScore && dimScore.leadingPole === def.poleA ? def.keyA : def.keyB;
    const dimState = {
      raw: { ...dnaState.dimensionState.raw },
      evidenceCardIds: { ...dnaState.dimensionState.evidenceCardIds },
    };
    if ((dimState.raw[leadingKey] || 0) >= 0) dimState.raw[leadingKey] = bumpOp(dimState.raw[leadingKey] || 0);
    updated.dimensionState = dimState;
  }

  if (feedback === 'confirmed') updated.confirmedDimensionLearnings = [...(dnaState.confirmedDimensionLearnings || []), record];
  else if (feedback === 'rejected') updated.rejectedDimensionLearnings = [...(dnaState.rejectedDimensionLearnings || []), record];
  else updated.unsureDimensionLearnings = [...(dnaState.unsureDimensionLearnings || []), record];

  updated.lastLearningCheckSwipeCount = dnaState.swipeCount;
  return updated;
}
