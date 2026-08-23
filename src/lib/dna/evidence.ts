import type { DimensionDef, DimensionResult, DnaCard, DnaState, Evidence, TensionDef, TensionResult, TensionSignalDef } from './types';

// Ported verbatim from traveldna.js:297-594 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/traveldna.js).

/**
 * Picks up to `n` distinct card ids, most-recent-first, from swipes that
 * pass `matches` — but Love swipes are drained first (most recent Love
 * before older Loves), then Yes swipes fill any remaining slots. A
 * genuine "hell yeah" should outrank a merely-more-recent "sure, I
 * guess" when deciding which card gets quoted as evidence.
 */
function pickEvidenceCardIds(dnaState: DnaState, n: number, matches: (cardId: string) => boolean): string[] {
  const swipes = [...(dnaState.swipes || [])].reverse();
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const preferredType of ['love', 'yes'] as const) {
    if (ids.length >= n) break;
    for (const sw of swipes) {
      if (ids.length >= n) break;
      if (sw.type !== preferredType || seen.has(sw.cardId) || !matches(sw.cardId)) continue;
      seen.add(sw.cardId);
      ids.push(sw.cardId);
    }
  }
  return ids;
}

export function pickEvidenceCardIdsForAttributes(
  dnaState: DnaState,
  allCards: DnaCard[],
  attrs: string[],
  n: number,
): string[] {
  return pickEvidenceCardIds(dnaState, n, (cardId) => {
    const card = allCards.find((c) => c.id === cardId);
    return !!card && attrs.some((a) => (card.preferenceSignals || {})[a] > 0);
  });
}

export function pickEvidenceCardIdsForPoles(
  dnaState: DnaState,
  allCards: DnaCard[],
  poleKeys: string[],
  n: number,
): string[] {
  return pickEvidenceCardIds(dnaState, n, (cardId) => {
    const card = allCards.find((c) => c.id === cardId);
    return !!card && poleKeys.some((k) => (card.dimensionSignals || {})[k] > 0);
  });
}

interface SideEvidence {
  matches: boolean;
  count: number;
  hasLove: boolean;
  supportingCardIds: string[];
}

/**
 * Evidence from positive swipes on cards touching a set of profile
 * attributes. The threshold (`matches`) is still checked against the
 * SUM across every key in `attrs` — a cluster of related signals can
 * legitimately add up to one claim. But when `primaryKeys` is given
 * (a side whose label names one specific thing, e.g. "wildlife" inside
 * a group that also includes the more general `remoteWilderness`),
 * `count`/`supportingCardIds` are drawn ONLY from cards touching those
 * primary keys — so a claim can't be "earned" purely by adjacent
 * signal, and the evidence line can't cite a card that never actually
 * touched the thing being claimed. Without this, e.g. "Loves wildlife"
 * could fire — and cite — cards that only ever touched `remoteWilderness`
 * (ATV rides, backcountry camping) and never `wildlife` itself.
 */
export function profileSideEvidence(
  dnaState: DnaState,
  allCards: DnaCard[],
  attrs: string[],
  min: number,
  primaryKeys?: string[],
): SideEvidence {
  const total = attrs.reduce((sum, a) => sum + Math.max(0, (dnaState.profile || {})[a] || 0), 0);
  const countKeys = primaryKeys && primaryKeys.length ? primaryKeys : attrs;
  const supportingCardIds = pickEvidenceCardIdsForAttributes(dnaState, allCards, countKeys, 6);
  const hasLove = (dnaState.swipes || []).some((sw) => sw.type === 'love' && supportingCardIds.includes(sw.cardId));
  return { matches: total >= min, count: supportingCardIds.length, hasLove, supportingCardIds };
}

/** Evidence from positive swipes on cards touching a set of dimension poles. See profileSideEvidence for what `primaryKeys` does. */
export function dimensionPoleSideEvidence(
  dnaState: DnaState,
  allCards: DnaCard[],
  poleKeys: string[],
  min: number,
  primaryKeys?: string[],
): SideEvidence {
  const state = dnaState.dimensionState;
  const total = poleKeys.reduce((sum, k) => sum + Math.max(0, state.raw[k] || 0), 0);
  const countKeys = primaryKeys && primaryKeys.length ? primaryKeys : poleKeys;
  const supportingCardIds = pickEvidenceCardIdsForPoles(dnaState, allCards, countKeys, 6);
  const hasLove = (dnaState.swipes || []).some((sw) => sw.type === 'love' && supportingCardIds.includes(sw.cardId));
  return { matches: total >= min, count: supportingCardIds.length, hasLove, supportingCardIds };
}

/**
 * Evidence from actual REJECTED (No) swipes on cards that positively
 * touch a set of profile attributes — the "dislikes X" side of a tension
 * where no dedicated attribute exists for the disliked thing itself.
 */
export function rejectedAttrsSideEvidence(
  dnaState: DnaState,
  allCards: DnaCard[],
  attrs: string[],
  min: number,
): SideEvidence {
  const rawIds = [
    ...new Set(
      (dnaState.swipes || [])
        .filter((sw) => sw.type === 'no')
        .map((sw) => sw.cardId)
        .filter((cardId) => {
          const card = allCards.find((c) => c.id === cardId);
          // Niche cards excluded: most people reject them regardless of their
          // actual stance on `attrs`, so a "no" here proves nothing about it.
          return card && !card.niche && attrs.some((a) => (card.preferenceSignals || {})[a] > 0);
        }),
    ),
  ];
  const matches = rawIds.length >= min;
  // `supportingCardIds` is only ever populated once the real threshold is
  // cleared — callers read this field directly for citation, so gating it
  // here (rather than relying on the separate `matches` flag, which most
  // callers never actually checked) is what makes `min` mean anything.
  const supportingCardIds = matches ? rawIds.slice(0, 6) : [];
  return { matches, count: rawIds.length, hasLove: false, supportingCardIds };
}

/**
 * Evidence from actual REJECTED (No) swipes on cards that positively
 * touch a set of dimension-pole keys — the dimension-signal counterpart
 * to rejectedAttrsSideEvidence. This is what makes "passed on X" genuine
 * for a dimension's trailing pole: a real no-swipe on a card that was
 * actually about the pole the user didn't lean toward, not merely a
 * card that happened to lean that way while still being liked/loved.
 */
export function rejectedPolesSideEvidence(dnaState: DnaState, allCards: DnaCard[], poleKeys: string[], min: number): SideEvidence {
  const rawIds = [
    ...new Set(
      (dnaState.swipes || [])
        .filter((sw) => sw.type === 'no')
        .map((sw) => sw.cardId)
        .filter((cardId) => {
          const card = allCards.find((c) => c.id === cardId);
          // Niche cards excluded: most people reject them regardless of their
          // actual pole lean, so a "no" here proves nothing about the pole.
          return card && !card.niche && poleKeys.some((k) => (card.dimensionSignals || {})[k] > 0);
        }),
    ),
  ];
  const matches = rawIds.length >= min;
  const supportingCardIds = matches ? rawIds.slice(0, 6) : [];
  return { matches, count: rawIds.length, hasLove: false, supportingCardIds };
}

/**
 * Evidence from actual REJECTED (No) swipes on cards that lean AWAY from
 * one side of a tension — i.e. cards that would represent that side's
 * claim taken too far or dropped entirely, which the user explicitly
 * turned down. Cards are authored with negative signal values for
 * exactly this ("this experience embodies the opposite of X"), but
 * nothing previously queried for them. Only meaningful for `profile`/
 * `dimensionPole` sides — a `rejectedAttrs` side already IS a rejection
 * by definition and is handled separately by rejectedAttrsSideEvidence.
 */
export function rejectedOppositeSideEvidence(dnaState: DnaState, allCards: DnaCard[], side: TensionSignalDef, min = 2): string[] {
  if (side.type === 'rejectedAttrs') return [];
  const field: 'dimensionSignals' | 'preferenceSignals' = side.type === 'dimensionPole' ? 'dimensionSignals' : 'preferenceSignals';
  const rawIds = [
    ...new Set(
      (dnaState.swipes || [])
        .filter((sw) => sw.type === 'no')
        .map((sw) => sw.cardId)
        .filter((cardId) => {
          const card = allCards.find((c) => c.id === cardId);
          // Niche cards excluded: most people reject them regardless of their
          // actual lean, so a "no" here proves nothing about the tension.
          return card && !card.niche && side.keys.some((k) => (card[field] || {})[k] < 0);
        }),
    ),
  ];
  return rawIds.length >= min ? rawIds.slice(0, 4) : [];
}

/** Splits a set of card ids into loved/liked, based on the user's ACTUAL swipe on each. */
export function classifySwipesByType(dnaState: DnaState, cardIds: string[]): { loved: string[]; liked: string[] } {
  const loved: string[] = [];
  const liked: string[] = [];
  cardIds.forEach((cid) => {
    const sw = (dnaState.swipes || []).find((s) => s.cardId === cid);
    if (!sw) return;
    if (sw.type === 'love') loved.push(cid);
    else if (sw.type === 'yes') liked.push(cid);
  });
  return { loved, liked };
}

/** Tags/subdimensions repeated across a set of evidence cards — only ones seen `minCount`+ times count as a real pattern. */
export function repeatedTagsFrom(cardIds: string[], allCards: DnaCard[], minCount: number): string[] {
  const freq: Record<string, number> = {};
  cardIds.forEach((cid) => {
    const card = allCards.find((c) => c.id === cid);
    if (!card) return;
    [...(card.tags || []), ...(card.subdimensions || [])].forEach((t) => {
      freq[t] = (freq[t] || 0) + 1;
    });
  });
  return Object.entries(freq)
    .filter(([, n]) => n >= minCount)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .slice(0, 4);
}

/**
 * Evidence for a dimension result: supporting = cards that pushed the
 * LEADING pole. Cards that were LIKED/LOVED but happened to push the
 * trailing pole are real counter-signal for the score, but they weren't
 * rejected, so they go into `loved`/`liked` too, not `opposingCardIds` —
 * `getWhyWeThinkThis` renders opposingCardIds as "passed on X", and a
 * card the user swiped yes/love on is not something they passed on.
 * `opposingCardIds` instead comes from `rejectedPolesSideEvidence`: real
 * no-swipes on cards that were actually about the trailing pole — a
 * genuine "you had the chance to lean the other way and declined it."
 */
export function generateEvidenceForDimension(
  dnaState: DnaState,
  allCards: DnaCard[],
  dimResult: DimensionResult,
  dimensions: DimensionDef[],
): Evidence | null {
  const def = dimensions.find((d) => d.id === dimResult.id);
  if (!def) return null;
  const leadingKey = dimResult.leadingPole === dimResult.poleA ? def.keyA : def.keyB;
  const trailingKey = dimResult.leadingPole === dimResult.poleA ? def.keyB : def.keyA;
  const supportingCardIds = pickEvidenceCardIdsForPoles(dnaState, allCards, [leadingKey], 6);
  const trailingCardIds = pickEvidenceCardIdsForPoles(dnaState, allCards, [trailingKey], 4);
  const opposingCardIds = rejectedPolesSideEvidence(dnaState, allCards, [trailingKey], 2).supportingCardIds;
  const supporting = classifySwipesByType(dnaState, supportingCardIds);
  const trailing = classifySwipesByType(dnaState, trailingCardIds);
  return {
    id: `evidence_${dimResult.id}`,
    targetType: 'dimension',
    targetId: dimResult.id,
    confidence: dimResult.confidence,
    supportingCardIds,
    opposingCardIds,
    supportingTags: repeatedTagsFrom(supportingCardIds, allCards, 2),
    opposingTags: repeatedTagsFrom([...trailingCardIds, ...opposingCardIds], allCards, 1),
    patternSummary: dimResult.summary,
    loved: [...supporting.loved, ...trailing.loved],
    liked: [...supporting.liked, ...trailing.liked],
  };
}

/**
 * Evidence for a tension: supporting = both sides' cards (the
 * contradiction itself is the evidence). Opposing only populated when a
 * side is a `rejectedAttrs` type (an actual No-swipe) OR when a real
 * no-swipe exists on a card authored with a negative signal for a
 * side's own keys — a card representing that side's claim taken too far
 * or dropped, which the user explicitly turned down (see
 * rejectedOppositeSideEvidence). Most tensions have neither side typed
 * `rejectedAttrs`, so this second path is what makes "passed on X"
 * possible for them at all.
 */
export function generateEvidenceForTension(
  dnaState: DnaState,
  allCards: DnaCard[],
  tensionResult: TensionResult,
  tensions: TensionDef[],
): Evidence | null {
  const def = tensions.find((t) => t.id === tensionResult.id);
  if (!def) return null;
  const supportingCardIds = [...tensionResult.signalA.supportingCardIds, ...tensionResult.signalB.supportingCardIds];
  const { loved, liked } = classifySwipesByType(dnaState, supportingCardIds);
  const opposingCardIds = [
    ...new Set([
      ...[def.signalA, def.signalB]
        .filter((s) => s.type === 'rejectedAttrs')
        .flatMap((s) => rejectedAttrsSideEvidence(dnaState, allCards, s.keys, s.min).supportingCardIds),
      ...[def.signalA, def.signalB].flatMap((s) => rejectedOppositeSideEvidence(dnaState, allCards, s)),
    ]),
  ].slice(0, 6);
  return {
    id: `evidence_${tensionResult.id}`,
    targetType: 'tension',
    targetId: tensionResult.id,
    confidence: tensionResult.confidence,
    supportingCardIds,
    opposingCardIds,
    supportingTags: repeatedTagsFrom(supportingCardIds, allCards, 2),
    opposingTags: repeatedTagsFrom(opposingCardIds, allCards, 1),
    patternSummary: tensionResult.insightText,
    loved,
    liked,
  };
}

/** Keeps an inline-quoted card title from turning an insight into a run-on sentence. */
export function shortenForInline(title: string, maxWords = 9): string {
  const words = title.split(' ');
  if (words.length <= maxWords) return title;
  return words.slice(0, maxWords).join(' ') + '…';
}

interface WhyWeThinkThis {
  loved: string[];
  liked: string[];
  rejected: string[];
  patternSummary: string;
}

/**
 * Resolves an evidence object into display-ready titles, capped so the UI
 * never dumps a huge list. Returns HTML fragments — each title comes back
 * wrapped in <em> so every consumer italicizes just the card label.
 */
export function getWhyWeThinkThis(evidence: Evidence | null, allCards: DnaCard[], maxEach = 3): WhyWeThinkThis {
  if (!evidence) return { loved: [], liked: [], rejected: [], patternSummary: '' };
  const titleOf = (id: string) => {
    const c = allCards.find((x) => x.id === id);
    return c ? `<em>${c.short || shortenForInline(c.title)}</em>` : id;
  };
  return {
    loved: (evidence.loved || []).slice(0, maxEach).map(titleOf),
    liked: (evidence.liked || []).slice(0, maxEach).map(titleOf),
    rejected: (evidence.opposingCardIds || []).slice(0, maxEach).map(titleOf),
    patternSummary: evidence.patternSummary || '',
  };
}

/** One short sentence for Insight/Learning Check prompts — "Why we're asking." */
export function buildEvidenceLine(evidence: Evidence | null, allCards: DnaCard[]): string {
  const why = getWhyWeThinkThis(evidence, allCards, 2);
  const parts: string[] = [];
  if (why.loved.length) parts.push(`loved ${why.loved.join(' and ')}`);
  if (why.liked.length) parts.push(`liked ${why.liked.join(' and ')}`);
  if (why.rejected.length) parts.push(`passed on ${why.rejected.join(' and ')}`);
  if (!parts.length) return '';
  return `You ${parts.join(', ')}.`;
}
