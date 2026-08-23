import { cardDomains } from './card-domains';
import { categoryInterestTier } from './interests';
import { isCardEligible } from './eligibility';
import { isDomainUnlocked } from './domains';
import type { DnaCard, DnaState, DomainDef, PreferenceProfile } from './types';

// Ported verbatim from traveldna.js:1088-1311 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/traveldna.js).
//
// NOTE: this function calls Math.random() at several points, in a fixed
// order/count per branch taken — faithfully preserved so that mocking
// Math.random() with an identical sequence in tests makes this produce
// byte-identical picks to the legacy implementation given identical input
// state. See tests/dna/selection.test.ts.

export function alignmentScore(card: DnaCard, profile: PreferenceProfile): number {
  return Object.entries(card.preferenceSignals || {}).reduce((sum, [attr, signal]) => {
    const pref = profile[attr] || 0;
    return sum + signal * pref;
  }, 0);
}

interface CategoryStat {
  seen: number;
  positive: number;
  negative: number;
}

/** Per-category swipe tally: how many times has each category been shown, and how did it go. */
export function categorySwipeStats(dnaState: DnaState, allCards: DnaCard[]): Record<string, CategoryStat> {
  const stats: Record<string, CategoryStat> = {};
  (dnaState.swipes || []).forEach((sw) => {
    const card = allCards.find((c) => c.id === sw.cardId);
    if (!card) return;
    if (!stats[card.category]) stats[card.category] = { seen: 0, positive: 0, negative: 0 };
    stats[card.category].seen += 1;
    if (sw.type === 'no') stats[card.category].negative += 1;
    else stats[card.category].positive += 1;
  });
  return stats;
}

/**
 * How the next card is picked, in priority order:
 *   0. FORCED — a committed deep dive always wins outright.
 *   0.5 PICKED-INTEREST PRIORITY — categories the user directly picked on
 *      the Basics screen. 40% chance, checked on every draw for the whole
 *      session (not just while "unexplored") — stronger and more durable
 *      than the correlated trickle below, since this is a direct signal
 *      rather than an inferred one. Without this, a picked category was
 *      pooled together with categories the interest picker doesn't even
 *      cover (tier1) in Mode 1 below, so picking an interest barely
 *      changed how often it actually appeared.
 *   1. BROAD DISCOVERY — any non-gated category has zero swipes, OR a
 *      domain with a deep card set shows early promise (1+ Love or 2+
 *      positive) but hasn't unlocked yet. 65% chance.
 *   1.5 CORRELATED TRICKLE — categories tied to something picked but not
 *      picked themselves. 30% chance.
 *   2. CALIBRATION REFINEMENT — score remaining cards by profile
 *      alignment: DIAGNOSTIC (ambiguous middle third, 15% chance),
 *      EXPLOIT (top slice, 70% of the remainder) or EXPLORE (the rest).
 * See traveldna.js:1088-1184 for the full rationale.
 */
export function chooseNextCard(dnaState: DnaState, allCards: DnaCard[], domains: DomainDef[]): DnaCard | null {
  // ---- Forced mode: a committed deep dive always wins ----
  if (dnaState.activeDeepDive) {
    const answeredForDive = new Set(dnaState.answeredCardIds || []);
    const nextId = dnaState.activeDeepDive.queue.find((id) => !answeredForDive.has(id));
    if (nextId) {
      const nextCard = allCards.find((c) => c.id === nextId);
      if (nextCard) return nextCard;
    }
    // Queue exhausted without the caller catching isDeepDiveComplete yet —
    // fall through to normal selection this one time.
  }

  const eligibleCards = allCards.filter((c) => isCardEligible(c, dnaState));
  const answered = new Set(dnaState.answeredCardIds || []);
  const unanswered = eligibleCards.filter((c) => !answered.has(c.id));
  if (!unanswered.length) return null;

  // ---- Interest-picker tiering ----
  const presentCategories = new Set(eligibleCards.map((c) => c.category));
  const correlatedCategories = new Set(
    [...presentCategories].filter((cat) => categoryInterestTier(cat, dnaState) === 'correlated'),
  );
  const lockedCategories = new Set([...presentCategories].filter((cat) => categoryInterestTier(cat, dnaState) === 'locked'));
  const gatedCategories = new Set([...correlatedCategories, ...lockedCategories]);
  const unlockedCategories = new Set(
    [...presentCategories].filter((cat) => categoryInterestTier(cat, dnaState) === 'unlocked'),
  );

  // ---- Mode 0.5: Picked-interest priority ----
  // Directly-picked categories get their own standing draw, independent of
  // "unexplored" status, so they stay boosted for the whole session — not
  // just their first appearance — and don't just get lumped in with
  // categories the interest picker never covered at all (see Mode 1).
  if (unlockedCategories.size) {
    const pool = unanswered.filter((c) => unlockedCategories.has(c.category));
    if (pool.length && Math.random() < 0.4) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }

  // ---- Mode 1: Broad discovery ----
  const stats = categorySwipeStats(dnaState, allCards);
  const unexploredCategories = [...presentCategories]
    .filter((cat) => !gatedCategories.has(cat))
    .filter((cat) => !stats[cat] || stats[cat].seen === 0);

  const domainStats: Record<string, { seen: number; positive: number; negative: number; love: number }> = {};
  (dnaState.swipes || []).forEach((sw) => {
    const card = allCards.find((c) => c.id === sw.cardId);
    if (!card) return;
    cardDomains(card, domains).forEach((domainKey) => {
      if (!domainStats[domainKey]) domainStats[domainKey] = { seen: 0, positive: 0, negative: 0, love: 0 };
      domainStats[domainKey].seen += 1;
      if (sw.type === 'no') domainStats[domainKey].negative += 1;
      else {
        domainStats[domainKey].positive += 1;
        if (sw.type === 'love') domainStats[domainKey].love += 1;
      }
    });
  });
  const promisingDomainKeys = domains
    .filter((def) => def.hasDeepCards && !isDomainUnlocked(dnaState, def.key))
    .filter((def) => {
      const s = domainStats[def.key];
      return s && (s.love >= 1 || s.positive >= 2);
    })
    .map((def) => def.key);

  // Domains whose deep dive already ran but came up with nothing to say —
  // same broad-discovery boost as promisingDomainKeys, just for cards on
  // the other side of a dive instead of before one. Without this they'd
  // only surface via Mode 2's alignment scoring, i.e. eventually and by
  // luck, instead of the app actually following through on the "still
  // zeroing in" promise made at the recap.
  const unresolvedDomainKeys = new Set(dnaState.unresolvedDeepDomains || []);

  if (unexploredCategories.length || promisingDomainKeys.length || unresolvedDomainKeys.size) {
    const pool = unanswered.filter(
      (c) =>
        unexploredCategories.includes(c.category) ||
        (c.stage === 'broad' && promisingDomainKeys.length > 0 && cardDomains(c, domains).some((d) => promisingDomainKeys.includes(d))) ||
        (c.stage === 'deep' && unresolvedDomainKeys.size > 0 && cardDomains(c, domains).some((d) => unresolvedDomainKeys.has(d))),
    );
    if (pool.length && Math.random() < 0.65) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }

  // ---- Mode 1.5: Correlated-category trickle ----
  if (correlatedCategories.size) {
    const pool = unanswered.filter((c) => correlatedCategories.has(c.category));
    if (pool.length && Math.random() < 0.3) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }

  // ---- Mode 2: Calibration refinement (exploit / explore / diagnostic) ----
  const nonGatedUnanswered = unanswered.filter((c) => !gatedCategories.has(c.category));
  const behaviorallyRejected = new Set(
    Object.entries(stats)
      .filter(([, s]) => s.negative - s.positive >= 2)
      .map(([cat]) => cat),
  );
  const eligible = nonGatedUnanswered.filter((c) => !behaviorallyRejected.has(c.category));
  const testRejectedAnyway = (behaviorallyRejected.size > 0 || gatedCategories.size > 0) && Math.random() < 0.1;
  const searchPool = testRejectedAnyway
    ? unanswered
    : eligible.length
      ? eligible
      : nonGatedUnanswered.length
        ? nonGatedUnanswered
        : unanswered;

  const scored = searchPool
    .map((card) => ({ card, score: alignmentScore(card, dnaState.profile) }))
    .sort((a, b) => b.score - a.score);

  // Diagnostic: the ambiguous middle third of the scored range.
  if (scored.length > 6 && Math.random() < 0.15) {
    const midStart = Math.floor(scored.length * 0.35);
    const midEnd = Math.ceil(scored.length * 0.65);
    const midSlice = scored.slice(midStart, midEnd);
    if (midSlice.length) return midSlice[Math.floor(Math.random() * midSlice.length)].card;
  }

  const exploit = Math.random() < 0.7;
  const cutoff = Math.max(5, Math.ceil(scored.length * 0.35));

  if (exploit || scored.length <= cutoff) {
    const topSlice = scored.slice(0, cutoff);
    return topSlice[Math.floor(Math.random() * topSlice.length)].card;
  }
  const restSlice = scored.slice(cutoff);
  return restSlice[Math.floor(Math.random() * restSlice.length)].card;
}
