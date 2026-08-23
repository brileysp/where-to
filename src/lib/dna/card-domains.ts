import type { DnaCard, DomainDef } from './types';

// Ported verbatim from domains.js:164-172 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/domains.js).

/**
 * Every domain a card contributes signal to — usually one, sometimes more.
 * Checks the card's own explicit `domain` field first (used by deep
 * cards, which always declare exactly which domain unlocked them), then
 * falls back to registry-driven category/tag matching so broad cards
 * don't need to be individually retrofitted for every domain that might
 * care about them.
 */
export function cardDomains(card: DnaCard, domains: DomainDef[]): string[] {
  const result = new Set<string>();
  if (card.domain) result.add(card.domain);
  domains.forEach((def) => {
    if (def.matchCategories && def.matchCategories.includes(card.category)) result.add(def.key);
    if (def.matchTags && card.tags && def.matchTags.some((t) => card.tags.includes(t))) result.add(def.key);
  });
  return [...result];
}
