import { cardDomains } from './card-domains';
import { passesBasicsFilters } from './eligibility';
import { pickEvidenceCardIdsForAttributes } from './evidence';
import type { DnaCard, DnaState, DomainDef } from './types';

// Ported verbatim from traveldna.js:958-1086,1749-1816 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/traveldna.js).

export interface DomainStat {
  seen: number;
  positive: number;
  negative: number;
  love: number;
}

/**
 * Per-domain swipe tally, built the same way categorySwipeStats() is, but
 * using cardDomains() instead of a raw category match — so a card can
 * count toward more than one domain (or none) depending on how the
 * registry defines that domain's signal.
 */
export function domainSwipeStats(
  dnaState: DnaState,
  allCards: DnaCard[],
  domains: DomainDef[],
): Record<string, DomainStat> {
  const stats: Record<string, DomainStat> = {};
  (dnaState.swipes || []).forEach((sw) => {
    const card = allCards.find((c) => c.id === sw.cardId);
    if (!card) return;
    cardDomains(card, domains).forEach((domainKey) => {
      if (!stats[domainKey]) stats[domainKey] = { seen: 0, positive: 0, negative: 0, love: 0 };
      stats[domainKey].seen += 1;
      if (sw.type === 'no') {
        stats[domainKey].negative += 1;
      } else {
        stats[domainKey].positive += 1;
        if (sw.type === 'love') stats[domainKey].love += 1;
      }
    });
  });
  return stats;
}

export function isDomainUnlocked(dnaState: DnaState, domainKey: string): boolean {
  return (dnaState.unlockedDomains || []).includes(domainKey);
}

/**
 * Checks every domain that HAS a deep card set and returns any that newly
 * cross their unlock threshold this swipe. Default rule "2+ Love OR 4+
 * positive" unless the domain overrides via its own unlock config.
 * Already-unlocked domains are skipped so this never re-fires.
 */
export function checkDomainUnlocks(dnaState: DnaState, allCards: DnaCard[], domains: DomainDef[]): string[] {
  const stats = domainSwipeStats(dnaState, allCards, domains);
  const newlyUnlocked: string[] = [];
  domains.forEach((def) => {
    if (!def.hasDeepCards) return;
    if (isDomainUnlocked(dnaState, def.key)) return;
    const s = stats[def.key];
    if (!s) return;
    const minPositive = def.unlockMinPositive ?? 4;
    const minLove = def.unlockMinLove ?? 2;
    if (s.love >= minLove || s.positive >= minPositive) {
      newlyUnlocked.push(def.key);
    }
  });
  return newlyUnlocked;
}

/**
 * Builds the ordered set of deep-card ids for one domain's committed
 * question block, up to `desiredCount` cards. Cards are stratified by
 * subdimension coverage — round-robining through the domain's declared
 * subdimensions and taking one unseen card per subdimension per pass —
 * rather than picked at random, so a block probes as many distinct
 * facets of the domain as possible. Falls back to filling with whatever's
 * left if subdimension coverage alone doesn't reach the target.
 */
export function buildDeepDiveQueue(
  domainKey: string,
  dnaState: DnaState,
  allCards: DnaCard[],
  domains: DomainDef[],
  desiredCount: number,
): string[] {
  const domainDef = domains.find((d) => d.key === domainKey);
  const answered = new Set(dnaState.answeredCardIds || []);
  // Core-axis specialty cards (see DOMAIN_CORE_AXES) are tagged with BOTH
  // their own specialty subdimension and the parent axis key (e.g.
  // ["xcEndurance", "mountainBiking"]), so the axis key alone can't
  // distinguish them from the domain's one true generic axis-probing
  // card. Left unfiltered, they'd compete in that same round-robin
  // bucket and could easily crowd out the generic probe — showing a
  // narrow, possibly-unappealing specific flavor instead of the neutral
  // "do you like X at all" question the axis actually needs answered
  // before it can honestly resolve. They're excluded here entirely;
  // rebranchDeepDiveQueue is the only place they should ever appear,
  // strictly after that axis has already resolved.
  const specialtyKeys = new Set(
    (DOMAIN_CORE_AXES[domainKey] || []).flatMap((axis) => axis.options.flatMap((o) => o.specialtySubdimensions)),
  );
  const candidates = allCards.filter(
    (c) =>
      c.stage === 'deep' &&
      c.domain === domainKey &&
      !answered.has(c.id) &&
      passesBasicsFilters(c, dnaState) &&
      !(c.subdimensions || []).some((s) => specialtyKeys.has(s)),
  );
  if (!candidates.length) return [];

  const subdims = domainDef?.subdimensions || [];
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const bySubdim = new Map<string, DnaCard[]>(subdims.map((s) => [s, []]));
  shuffled.forEach((c) => {
    (c.subdimensions || []).forEach((s) => {
      if (bySubdim.has(s)) bySubdim.get(s)!.push(c);
    });
  });

  const picked: DnaCard[] = [];
  const pickedIds = new Set<string>();

  // Reserve up to MIN_NUANCE_EVIDENCE cards per core-axis option FIRST,
  // in shuffled option order. Axis resolution (and the pill UI) needs 2+
  // positive-signal cards for the SAME option, which the generic
  // single-pass round robin below can't reliably provide once a domain
  // has more subdimensions than the dive has slots for — with 20 LP
  // subdimensions and a 6-10 card budget, one full pass already exhausts
  // the budget on whichever subdims happen to be declared first, so an
  // option like coastlines or forests could get zero cards, and none
  // ever get a 2nd card at all. Shuffling option order (rather than
  // always favoring axis declaration order) spreads that scarcity fairly
  // across sessions instead of always starving the same late options.
  const axisOptionKeys = (DOMAIN_CORE_AXES[domainKey] || [])
    .flatMap((axis) => axis.options.map((o) => o.key))
    .sort(() => Math.random() - 0.5);
  for (const key of axisOptionKeys) {
    if (picked.length >= desiredCount) break;
    const list = bySubdim.get(key) || [];
    let reserved = 0;
    for (const c of list) {
      if (picked.length >= desiredCount || reserved >= MIN_NUANCE_EVIDENCE) break;
      if (pickedIds.has(c.id)) continue;
      picked.push(c);
      pickedIds.add(c.id);
      reserved += 1;
    }
  }

  // Shuffle subdim order per call too, so generic (non-axis) coverage
  // doesn't always favor whichever subdimensions happen to be declared
  // first in the domain registry.
  const shuffledSubdims = [...subdims].sort(() => Math.random() - 0.5);
  let madeProgress = true;
  while (madeProgress && picked.length < desiredCount) {
    madeProgress = false;
    for (const s of shuffledSubdims) {
      if (picked.length >= desiredCount) break;
      const list = bySubdim.get(s) || [];
      const next = list.find((c) => !pickedIds.has(c.id));
      if (next) {
        picked.push(next);
        pickedIds.add(next.id);
        madeProgress = true;
      }
    }
  }
  if (picked.length < desiredCount) {
    for (const c of shuffled) {
      if (picked.length >= desiredCount) break;
      if (!pickedIds.has(c.id)) {
        picked.push(c);
        pickedIds.add(c.id);
      }
    }
  }
  return picked.map((c) => c.id);
}

/**
 * Starts a new committed deep-dive block for a domain: 6-10 questions,
 * trimmed down to however many relevant cards actually exist. `target` is
 * the ACTUAL queue length, not the desired count, so isDeepDiveComplete
 * has a real number to compare against even when fewer deep cards exist
 * than usual.
 */
export function startDeepDive(
  domainKey: string,
  dnaState: DnaState,
  allCards: DnaCard[],
  domains: DomainDef[],
): { domain: string; queue: string[]; seenCount: number; target: number; branchedAxes: string[]; extended: boolean } {
  // A domain with more core-axis options needs more room in the block to
  // have any real chance of reserving MIN_NUANCE_EVIDENCE cards for each
  // one (see buildDeepDiveQueue) — 6-10 was sized for a domain with no
  // axis or a small one (Cycling's 3 options fit fine), but Landscape
  // Photography's 5 options (4 Terrain + Night Sky) need up to 10 slots
  // just for guaranteed axis coverage, let alone any generic questions.
  const axisOptionCount = (DOMAIN_CORE_AXES[domainKey] || []).reduce((n, axis) => n + axis.options.length, 0);
  const MIN_QUESTIONS = Math.max(6, axisOptionCount * 2);
  const MAX_QUESTIONS = Math.max(10, axisOptionCount * 2 + 4);
  const desired = MIN_QUESTIONS + Math.floor(Math.random() * (MAX_QUESTIONS - MIN_QUESTIONS + 1));
  const queue = buildDeepDiveQueue(domainKey, dnaState, allCards, domains, desired);
  return { domain: domainKey, queue, seenCount: 0, target: queue.length, branchedAxes: [], extended: false };
}

/** True once the active deep dive has hit its question target or run out of queued cards. */
export function isDeepDiveComplete(dnaState: DnaState): boolean {
  const dive = dnaState.activeDeepDive;
  if (!dive) return false;
  const answered = new Set(dnaState.answeredCardIds || []);
  const remaining = dive.queue.filter((id) => !answered.has(id));
  return dive.seenCount >= dive.target || remaining.length === 0;
}

const DEEP_DIVE_EXTENSION_SIZE = 4;

/**
 * True once a domain has earned at least one real nuance line — i.e.
 * generateDomainRecap has something specific to say rather than falling
 * back to "still zeroing in on your exact style." Exported so screens can
 * decide whether there's actually a conclusion to ask the user to rate,
 * and so resolveUnresolvedDomains can tell when a previously-inconclusive
 * domain has since earned a real answer.
 */
export function hasEarnedDomainNuance(domainKey: string, dnaState: DnaState, allCards: DnaCard[]): boolean {
  const templates = DOMAIN_NUANCE_TEMPLATES[domainKey] || [];
  return templates.some((t) => t.test(dnaState, allCards));
}

/**
 * Drops any domain from unresolvedDeepDomains once it's earned a real
 * nuance line from the extra cards it's been getting blended into
 * ordinary swiping — called after every swipe, same as the other
 * post-swipe re-derivations below. Once a domain resolves this way, its
 * deep cards stop being specially eligible again (see isCardEligible),
 * so it closes out exactly like a domain that resolved during its
 * original committed block.
 */
export function resolveUnresolvedDomains(dnaState: DnaState, allCards: DnaCard[]): DnaState {
  const unresolved = dnaState.unresolvedDeepDomains || [];
  if (!unresolved.length) return dnaState;
  const stillUnresolved = unresolved.filter((domainKey) => !hasEarnedDomainNuance(domainKey, dnaState, allCards));
  if (stillUnresolved.length === unresolved.length) return dnaState;
  return { ...dnaState, unresolvedDeepDomains: stillUnresolved };
}

/**
 * A fixed 6-10 question block can honestly land on "still zeroing in" —
 * plenty of real evidence just didn't happen to cluster into any of the
 * domain's nuance claims yet. Without this, that's where the domain
 * dead-ends permanently (deep cards for a completed dive are gone for
 * good — see isCardEligible) even though the recap text itself promises
 * more is coming. This gives it exactly one extra batch of real,
 * unseen cards to try to actually earn something before the domain
 * closes out — not an open-ended chase, since a second miss means there
 * genuinely isn't more signal to gather from the cards that exist.
 */
export function maybeExtendDeepDive(dnaState: DnaState, allCards: DnaCard[], domains: DomainDef[]): DnaState {
  const dive = dnaState.activeDeepDive;
  if (!dive || dive.extended) return dnaState;
  if (!isDeepDiveComplete(dnaState)) return dnaState;
  if (hasEarnedDomainNuance(dive.domain, dnaState, allCards)) return dnaState;

  const answered = new Set(dnaState.answeredCardIds || []);
  const alreadyQueued = new Set(dive.queue);
  const specialtyKeys = new Set(
    (DOMAIN_CORE_AXES[dive.domain] || []).flatMap((axis) => axis.options.flatMap((o) => o.specialtySubdimensions)),
  );
  const moreCandidates = allCards.filter(
    (c) =>
      c.stage === 'deep' &&
      c.domain === dive.domain &&
      !answered.has(c.id) &&
      !alreadyQueued.has(c.id) &&
      passesBasicsFilters(c, dnaState) &&
      !(c.subdimensions || []).some((s) => specialtyKeys.has(s)),
  );
  if (!moreCandidates.length) return dnaState;

  // Prioritize any axis option that's "almost there" (has some evidence
  // but hasn't hit MIN_NUANCE_EVIDENCE yet) — e.g. one loved desert card
  // with no second one queued anywhere. Without this, a near-miss on an
  // axis option is exactly as likely to get topped off as any other
  // random unseen card, even though closing it out is what would
  // actually let the user earn the pill they were already showing real
  // interest in.
  const almostThereKeys = new Set(
    (DOMAIN_CORE_AXES[dive.domain] || [])
      .flatMap((axis) => axis.options.map((o) => o.key))
      .filter((key) => {
        const n = pickEvidenceCardIdsForAttributes(dnaState, allCards, [key], MIN_NUANCE_EVIDENCE).length;
        return n > 0 && n < MIN_NUANCE_EVIDENCE;
      }),
  );
  const shuffledCandidates = [...moreCandidates].sort(() => Math.random() - 0.5);
  const prioritized = shuffledCandidates.filter((c) => (c.subdimensions || []).some((s) => almostThereKeys.has(s)));
  const rest = shuffledCandidates.filter((c) => !prioritized.includes(c));
  const extraIds = [...prioritized, ...rest].slice(0, DEEP_DIVE_EXTENSION_SIZE).map((c) => c.id);
  return {
    ...dnaState,
    activeDeepDive: { ...dive, queue: [...dive.queue, ...extraIds], target: dive.target + extraIds.length, extended: true },
  };
}

// ---- Summary nuance ---------------------------------------------------------

interface NuanceTemplate {
  test: (dnaState: DnaState, allCards: DnaCard[]) => boolean;
  text: string;
}

const MIN_NUANCE_EVIDENCE = 2;

/**
 * True only when at least MIN_NUANCE_EVIDENCE distinct positively-swiped
 * cards actually touch one of `keys` — the same bar dimensions/tensions
 * already require. Without this, a nuance line could fire off a single
 * strongly-loved card, or off a profile total nudged up by an unrelated
 * swipe, since these templates otherwise only ever look at accumulated
 * profile totals, never real card counts.
 */
function hasNuanceEvidence(dnaState: DnaState, allCards: DnaCard[], keys: string[], n = MIN_NUANCE_EVIDENCE): boolean {
  return pickEvidenceCardIdsForAttributes(dnaState, allCards, keys, n).length >= n;
}

// ---- Core axes: adaptive deep-dive branching --------------------------------

/**
 * One option on a domain's core axis (e.g. "Mountain" on Cycling's
 * Terrain axis). `key` is the preferenceSignal that represents choosing
 * this option; `specialtySubdimensions` names the finer-grained deep
 * cards that only make sense once this option is genuinely resolved —
 * these are deliberately left out of the domain's registered
 * `subdimensions` list so buildDeepDiveQueue's generic round-robin never
 * surfaces them before the branch is earned.
 */
export interface AxisOption {
  key: string;
  label: string;
  specialtySubdimensions: string[];
}

/**
 * A domain's most fundamental split — the "what kind of X do you even
 * like" question that most determines what a person wants, as opposed to
 * the domain's other (logistics/comfort/style) subdimensions. See the
 * Cycling Terrain axis below for the canonical example.
 */
export interface CoreAxis {
  name: string;
  options: AxisOption[];
}

export const DOMAIN_CORE_AXES: Record<string, CoreAxis[]> = {
  Cycling: [
    {
      name: 'Terrain',
      options: [
        { key: 'scenicRoadCycling', label: 'Road', specialtySubdimensions: [] },
        {
          key: 'gravelRiding',
          label: 'Gravel',
          specialtySubdimensions: ['gravelRacing', 'gravelBikepacking', 'remoteGravelExploration', 'casualGravelWandering'],
        },
        {
          key: 'mountainBiking',
          label: 'Mountain',
          specialtySubdimensions: [
            'xcEndurance',
            'enduroRiding',
            'bikeParkDownhill',
            'mtbBikepacking',
            'epicAllMountainDay',
            'technicalSkillsCoaching',
          ],
        },
      ],
    },
  ],
  'Landscape Photography': [
    {
      // What kind of terrain the person actually wants to shoot — maps
      // almost directly onto destination geography (a desert-shooter
      // wants Atacama/Namibia, not Icelandic fjords), unlike a style/
      // approach split which barely discriminates between destinations
      // at all. No specialty pools yet for any option — every Terrain
      // pill is earnable today, but none has deeper branch-specific
      // content (matches Cycling's Road, left for a future pass).
      name: 'Terrain',
      options: [
        { key: 'deserts', label: 'Desert', specialtySubdimensions: [] },
        { key: 'mountains', label: 'Mountain', specialtySubdimensions: [] },
        { key: 'forests', label: 'Forest', specialtySubdimensions: [] },
        { key: 'coastlines', label: 'Coastal', specialtySubdimensions: [] },
      ],
    },
    {
      // Single-option axis, deliberately — astrophotography isn't a
      // place (like Terrain) or one pole of a two-sided style debate,
      // it's a condition that either pulls someone or doesn't. A
      // destination's suitability for it is close to binary (dark
      // skies/latitude either support it or don't), which is exactly
      // the kind of sharp differentiator this mechanism exists for.
      name: 'Night Sky',
      options: [
        {
          key: 'astrophotography',
          label: 'Night Sky',
          specialtySubdimensions: ['milkyWayChasing', 'auroraChasing', 'starTrails', 'moonlitLandscapes'],
        },
      ],
    },
  ],
};

const MIN_AXIS_PROBE_SWIPES = 5;

/** How many of this domain's OWN deep cards the user has already answered. */
function domainDeepSwipeCount(dnaState: DnaState, allCards: DnaCard[], domainKey: string): number {
  const answered = new Set(dnaState.answeredCardIds || []);
  return allCards.filter((c) => c.stage === 'deep' && c.domain === domainKey && answered.has(c.id)).length;
}

/**
 * Which of this axis's options have real, independent evidence behind
 * them — each option is judged on its own merits (the same ≥2-card bar
 * as hasNuanceEvidence), with no requirement that the others be low. A
 * person can genuinely resolve two or three options on the same axis at
 * once (loves road AND gravel AND mountain); that's a real outcome, not
 * a case to force an artificial single winner out of.
 *
 * Deliberately does NOT require specialtySubdimensions.length > 0 — an
 * option with no specialty card pool yet (e.g. Cycling's Road, or any of
 * Landscape Photography's Terrain options) can still resolve as a real,
 * evidenced earned style for destination-scoring purposes (see
 * resolveEarnedStyles); it just won't have anything for
 * rebranchDeepDiveQueue to swap the deep-dive queue into, which that
 * function's own per-option specialty-pool check already handles
 * correctly on its own.
 */
export function resolveAxisOptions(dnaState: DnaState, allCards: DnaCard[], axis: CoreAxis): AxisOption[] {
  return axis.options.filter((opt) => hasNuanceEvidence(dnaState, allCards, [opt.key]));
}

/**
 * Maps a domain key to the destination-scoring slider key its core axis
 * pills should attach to (see activityStyleTiers in db/schema.ts and
 * TIER_MULTIPLIERS in scoring/rank.ts). Opt-in — a domain with a core
 * axis but no entry here just doesn't feed destination scoring yet.
 */
export const DOMAIN_AXIS_SLIDER_KEY: Record<string, string> = {
  Cycling: 'cyclingRoad',
  'Landscape Photography': 'landscapePhotography',
};

/**
 * Collapses every domain's resolved core-axis options into one
 * slider-keyed map of "earned" style pills — e.g. { cycling:
 * ['mountainBiking', 'gravelRiding'] } — for persisting onto a user's
 * preferences (userPreferences.earnedStyles) once onboarding finishes.
 * Reuses the exact same option keys the DNA engine already resolves, so
 * there's no separate vocabulary between the swipe engine and
 * destination-scoring content to keep in sync.
 */
export function resolveEarnedStyles(dnaState: DnaState, allCards: DnaCard[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  Object.entries(DOMAIN_CORE_AXES).forEach(([domainKey, axes]) => {
    const sliderKey = DOMAIN_AXIS_SLIDER_KEY[domainKey];
    if (!sliderKey) return;
    const resolvedKeys = axes.flatMap((axis) => resolveAxisOptions(dnaState, allCards, axis).map((o) => o.key));
    if (resolvedKeys.length) result[sliderKey] = resolvedKeys;
  });
  return result;
}

/**
 * Human-readable label for a style pill (e.g. 'mountainBiking' -> 'Mountain')
 * given the slider key it's earned/selected under — reverse-looks-up
 * DOMAIN_AXIS_SLIDER_KEY to find the owning domain's axis options, so the
 * results-page pill UI never has to duplicate this vocabulary. Falls back
 * to the raw key if a style somehow isn't declared on any axis.
 */
export function getStyleLabel(sliderKey: string, styleKey: string): string {
  const domainKey = Object.entries(DOMAIN_AXIS_SLIDER_KEY).find(([, v]) => v === sliderKey)?.[0];
  const axes = domainKey ? DOMAIN_CORE_AXES[domainKey] : undefined;
  const option = axes?.flatMap((axis) => axis.options).find((o) => o.key === styleKey);
  return option?.label ?? styleKey;
}

/**
 * Which axis a style pill belongs to (e.g. 'astrophotography' -> 'Night
 * Sky'), for grouping pills visually when a slider has more than one
 * core axis feeding it (Landscape Photography's Terrain + Night Sky both
 * attach to 'scenic') — without this, several axes' pills would render
 * as one undifferentiated row. Falls back to the slider key itself for
 * single-axis domains (Cycling), which don't need the distinction.
 */
export function getStyleAxisName(sliderKey: string, styleKey: string): string {
  const domainKey = Object.entries(DOMAIN_AXIS_SLIDER_KEY).find(([, v]) => v === sliderKey)?.[0];
  const axes = domainKey ? DOMAIN_CORE_AXES[domainKey] : undefined;
  const axis = axes?.find((a) => a.options.some((o) => o.key === styleKey));
  return axis?.name ?? sliderKey;
}

/**
 * Once a core axis resolves (see resolveAxisOptions), swaps the deep
 * dive's remaining, not-yet-answered queue slots for deeper cards from
 * the resolved option(s)' specialty pools — instead of continuing to
 * spend the budget on generic axis-probing cards for something already
 * proven. Waits for MIN_AXIS_PROBE_SWIPES real answers in this domain
 * first, so a couple of early loves can't trigger a premature branch.
 * Each axis only branches once (tracked via branchedAxes) — already
 * answered cards are never touched, and the dive's total target count is
 * preserved. When 2+ options resolve at once, their specialty cards are
 * interleaved round-robin so the "loves everything" case samples every
 * resolved branch rather than exhausting just one.
 */
export function rebranchDeepDiveQueue(dnaState: DnaState, allCards: DnaCard[], domains: DomainDef[]): DnaState {
  const dive = dnaState.activeDeepDive;
  if (!dive) return dnaState;

  const axes = DOMAIN_CORE_AXES[dive.domain];
  if (!axes || !axes.length) return dnaState;
  if (domainDeepSwipeCount(dnaState, allCards, dive.domain) < MIN_AXIS_PROBE_SWIPES) return dnaState;

  const answered = new Set(dnaState.answeredCardIds || []);
  const branchedAxes = new Set(dive.branchedAxes || []);
  let queue = dive.queue;
  let changed = false;

  for (const axis of axes) {
    if (branchedAxes.has(axis.name)) continue;
    const resolved = resolveAxisOptions(dnaState, allCards, axis);
    if (!resolved.length) continue;

    const specialtyKeys = new Set(resolved.flatMap((o) => o.specialtySubdimensions));
    const isSpecialtyCard = (id: string) => {
      const card = allCards.find((c) => c.id === id);
      return !!card && (card.subdimensions || []).some((s) => specialtyKeys.has(s));
    };

    const answeredInQueue = queue.filter((id) => answered.has(id));
    // A specialty card can already be sitting unanswered in the queue —
    // buildDeepDiveQueue's fallback fill doesn't know about specialty
    // pools and can pick one incidentally. Keep it rather than discarding
    // and re-picking, so nothing already lined up for the user is lost.
    const keptSpecialtyIds = queue.filter((id) => !answered.has(id) && isSpecialtyCard(id));
    const alreadyQueued = new Set(queue);

    const specialtyCards = allCards.filter(
      (c) =>
        c.stage === 'deep' &&
        c.domain === dive.domain &&
        !answered.has(c.id) &&
        !alreadyQueued.has(c.id) &&
        resolved.some((o) => (c.subdimensions || []).some((s) => o.specialtySubdimensions.includes(s))),
    );
    if (!specialtyCards.length && !keptSpecialtyIds.length) continue;

    const byOption = new Map<string, DnaCard[]>(resolved.map((o) => [o.key, []]));
    specialtyCards.forEach((c) => {
      resolved.forEach((o) => {
        if ((c.subdimensions || []).some((s) => o.specialtySubdimensions.includes(s))) {
          byOption.get(o.key)!.push(c);
        }
      });
    });

    const interleaved: DnaCard[] = [];
    const pickedIds = new Set<string>();
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const o of resolved) {
        const next = (byOption.get(o.key) || []).find((c) => !pickedIds.has(c.id));
        if (next) {
          interleaved.push(next);
          pickedIds.add(next.id);
          progressed = true;
        }
      }
    }

    const remainingSlots = Math.max(dive.target - answeredInQueue.length - keptSpecialtyIds.length, 0);
    const freshSpecialtyIds = interleaved.slice(0, remainingSlots).map((c) => c.id);
    queue = [...answeredInQueue, ...keptSpecialtyIds, ...freshSpecialtyIds];
    branchedAxes.add(axis.name);
    changed = true;
  }

  if (!changed) return dnaState;
  return { ...dnaState, activeDeepDive: { ...dive, queue, branchedAxes: Array.from(branchedAxes) } };
}

/**
 * Short, specific sentences for the summary's "Nuance we learned" section
 * — shows DEPTH within a strong domain, not just that the domain is
 * strong. Domain-specific templates only evaluate for domains the user
 * actually unlocked; general templates apply regardless of domain.
 *
 * Every exclusive/contrastive claim ("not the scenery", "not just easy
 * hides") is required to check the OPPOSING signal is actually low, not
 * just that the claimed side crossed a threshold — a user can easily be
 * high on both sides of one of these pairs (e.g. loves climbing AND
 * scenery), and asserting exclusivity without evidence of a real
 * trade-off reads as a confident, generic-feeling guess instead of an
 * earned insight. Where a domain has a genuine "both" case, it gets its
 * own additive (not exclusionary) line instead of defaulting to whichever
 * threshold happened to be checked first.
 */
export const DOMAIN_NUANCE_TEMPLATES: Record<string, NuanceTemplate[]> = {
  Birding: [
    {
      test: (s, c) =>
        (s.profile.rareEndemics >= 4 || s.profile.photography >= 4) &&
        s.profile.casualBirding < 2 &&
        hasNuanceEvidence(s, c, ['rareEndemics', 'photography']),
      text: "You're target-driven and photography-focused, not a casual walker.",
    },
    {
      test: (s, c) => s.profile.pelagicBirding >= 3 && s.profile.casualBirding < 2 && hasNuanceEvidence(s, c, ['pelagicBirding']),
      text: 'You want pelagic trips and specialist guiding, not just easy hides.',
    },
    {
      test: (s, c) => s.profile.casualBirding >= 3 && s.profile.rareEndemics < 2 && hasNuanceEvidence(s, c, ['casualBirding']),
      text: "Birding's a nice add-on for you, not the main reason to travel.",
    },
  ],
  Surfing: [
    {
      test: (s, c) =>
        (s.profile.reefBreaks >= 3 || s.profile.uncrowded >= 3) &&
        s.profile.beginnerFriendly < 2 &&
        hasNuanceEvidence(s, c, ['reefBreaks', 'uncrowded']),
      text: 'You want serious, uncrowded breaks over polished beginner spots.',
    },
    {
      test: (s, c) => s.profile.warmWater >= 3 && s.profile.seriousSurfIntensity <= 0 && hasNuanceEvidence(s, c, ['warmWater']),
      text: "Surfing's a warm-water, easygoing add-on for you, not the main event.",
    },
    {
      test: (s, c) => s.profile.surfCamp >= 3 && hasNuanceEvidence(s, c, ['surfCamp']),
      text: 'The social scene matters almost as much as the waves.',
    },
  ],
  Cycling: [
    // Core-axis branch specialties come first: once a branch is earned
    // (see DOMAIN_CORE_AXES/rebranchDeepDiveQueue), that specific claim
    // should win over the broader generic templates below, which would
    // otherwise fire on the same evidence and crowd out the more
    // specific, more interesting insight (matches the "prefer narrow over
    // generic" rule already used for the mid-swipe insight check).
    {
      test: (s, c) => hasNuanceEvidence(s, c, ['xcEndurance']),
      text: "You're in it for fitness and flow, not for features — climbing under your own power beats a lift-served park lap.",
    },
    {
      test: (s, c) => hasNuanceEvidence(s, c, ['enduroRiding']),
      text: 'Descending is the reward — climbing is just how you get there.',
    },
    {
      test: (s, c) => hasNuanceEvidence(s, c, ['bikeParkDownhill']),
      text: 'You want laps, not miles — features and gravity, not endurance.',
    },
    {
      test: (s, c) => hasNuanceEvidence(s, c, ['mtbBikepacking']),
      text: 'Multi-day, self-supported singletrack is the real draw — getting somewhere remote matters as much as the riding.',
    },
    {
      test: (s, c) => hasNuanceEvidence(s, c, ['epicAllMountainDay']),
      text: 'Long point-to-point days in big terrain — the journey matters more than technical tricks.',
    },
    {
      test: (s, c) => hasNuanceEvidence(s, c, ['technicalSkillsCoaching']),
      text: "You're actively working on the moves, not just riding what you already know.",
    },
    {
      test: (s, c) => hasNuanceEvidence(s, c, ['gravelRacing']),
      text: 'Structured, competitive gravel events pull you in — timed and supported, not aimless.',
    },
    {
      test: (s, c) => hasNuanceEvidence(s, c, ['gravelBikepacking']),
      text: 'Same drive as multi-day mountain biking, just on rideable backroads.',
    },
    {
      test: (s, c) => hasNuanceEvidence(s, c, ['remoteGravelExploration']),
      text: 'You want gravel that barely counts as a road — isolation over polish.',
    },
    {
      test: (s, c) => hasNuanceEvidence(s, c, ['casualGravelWandering']),
      text: 'Gravel is a low-stakes wander for you, not a performance pursuit.',
    },
    // Genuine multi-branch case: 2+ terrain options independently
    // evidenced means the person isn't picky about terrain at all — an
    // earned additive claim, not a forced single winner. Also ranked
    // ahead of the generic templates below for the same reason.
    {
      test: (s, c) =>
        [
          hasNuanceEvidence(s, c, ['scenicRoadCycling']),
          hasNuanceEvidence(s, c, ['gravelRiding']),
          hasNuanceEvidence(s, c, ['mountainBiking']),
        ].filter(Boolean).length >= 2,
      text: "You're not picky about terrain — road, gravel, or singletrack, you just want to ride.",
    },
    {
      test: (s, c) =>
        (s.profile.hardClimbing >= 3 || s.profile.mountainBiking >= 3) &&
        s.profile.scenicRoadCycling < 2 &&
        hasNuanceEvidence(s, c, ['hardClimbing', 'mountainBiking']),
      text: 'You ride for the physical challenge, not the scenery.',
    },
    {
      test: (s, c) => s.profile.scenicRoadCycling >= 3 && s.profile.hardClimbing < 2 && hasNuanceEvidence(s, c, ['scenicRoadCycling']),
      text: 'You ride for scenery and place, not pure performance.',
    },
    {
      test: (s, c) =>
        (s.profile.hardClimbing >= 3 || s.profile.mountainBiking >= 3) &&
        s.profile.scenicRoadCycling >= 3 &&
        hasNuanceEvidence(s, c, ['hardClimbing', 'mountainBiking']) &&
        hasNuanceEvidence(s, c, ['scenicRoadCycling']),
      text: 'You want the real climbs AND the views — not an easy spin.',
    },
    {
      test: (s, c) => s.profile.eBikeFriendly >= 3 && s.profile.hardClimbing < 2 && hasNuanceEvidence(s, c, ['eBikeFriendly']),
      text: 'You want the views, not the suffering.',
    },
  ],
  'Landscape Photography': [
    {
      test: (s, c) =>
        (s.profile.goldenHour >= 3 || s.profile.dramaticWeather >= 3) &&
        s.profile.solitude > 0 &&
        hasNuanceEvidence(s, c, ['goldenHour', 'dramaticWeather']) &&
        hasNuanceEvidence(s, c, ['solitude']),
      text: 'Timing, solitude, and dramatic light drive you most.',
    },
    {
      test: (s, c) =>
        s.profile.astrophotography >= 3 &&
        s.profile.goldenHour < 2 &&
        s.profile.iconicLandscapes < 2 &&
        hasNuanceEvidence(s, c, ['astrophotography']),
      text: 'Night-sky photography is a real draw, not just daytime scenery.',
    },
    {
      test: (s, c) => s.profile.iconicLandscapes >= 3 && s.profile.solitude <= 0 && hasNuanceEvidence(s, c, ['iconicLandscapes']),
      text: "You'll brave the crowds for a famous viewpoint.",
    },
  ],
};

export const GENERAL_NUANCE_TEMPLATES: NuanceTemplate[] = [
  {
    test: (s, c) => s.profile.comfortFlexibility >= 5 && hasNuanceEvidence(s, c, ['comfortFlexibility']),
    text: 'Comfort can be flexible for you when the payoff is high.',
  },
  {
    test: (s, c) => s.profile.luxury <= 1 && s.profile.authenticity >= 4 && hasNuanceEvidence(s, c, ['authenticity']),
    text: 'Luxury matters less as a standalone motivator than authenticity and access.',
  },
];

/**
 * The recap shown right after a domain's committed deep-dive question
 * block finishes. Reuses DOMAIN_NUANCE_TEMPLATES so the recap and the
 * summary screen's "Nuance we learned" section stay consistent, assembling
 * up to 2 matches into one paragraph focused on just this domain.
 */
export function generateDomainRecap(domainKey: string, dnaState: DnaState, allCards: DnaCard[], domains: DomainDef[]): string {
  const def = domains.find((d) => d.key === domainKey);
  const templates = DOMAIN_NUANCE_TEMPLATES[domainKey] || [];
  const matches = templates.filter((t) => t.test(dnaState, allCards)).map((t) => t.text);
  if (matches.length) return matches.slice(0, 2).join(' ');
  const label = (def?.label || domainKey).toLowerCase();
  return `You're clearly into ${label} — we're still zeroing in on your exact style.`;
}

/** Domain-specific nuance first (unlocked domains only), then general. */
export function computeSummaryNuance(dnaState: DnaState, allCards: DnaCard[]): string[] {
  const lines: string[] = [];
  (dnaState.unlockedDomains || []).forEach((domainKey) => {
    const templates = DOMAIN_NUANCE_TEMPLATES[domainKey] || [];
    const matches = templates.filter((t) => t.test(dnaState, allCards)).slice(0, 2);
    matches.forEach((m) => lines.push(m.text));
  });
  GENERAL_NUANCE_TEMPLATES.forEach((t) => {
    if (t.test(dnaState, allCards)) lines.push(t.text);
  });
  return lines;
}
