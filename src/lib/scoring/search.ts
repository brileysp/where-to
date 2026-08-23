import type { ScoredDestination } from './types';

// Ported verbatim from app.js:774-794 (legacy app at
// /Users/brendansalant-pearce/Desktop/Claude Code/where-to/app.js).

/**
 * Tiered substring match against name / region / searchAliases. Aliases
 * are matched but never displayed — a destination found via an alias still
 * surfaces under its real name/region.
 */
export function searchDestinations(destinations: ScoredDestination[], query: string): ScoredDestination[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return destinations
    .map((d) => {
      const name = d.name.toLowerCase();
      const region = (d.region || '').toLowerCase();
      const aliases = (d.searchAliases || []).map((a) => a.toLowerCase());
      let tier: number;
      if (name === q) tier = 0;
      else if (name.startsWith(q)) tier = 1;
      else if (name.includes(q)) tier = 2;
      else if (region.includes(q)) tier = 3;
      else if (aliases.some((a) => a.includes(q))) tier = 4;
      else tier = -1;
      return { d, tier };
    })
    .filter((x) => x.tier >= 0)
    .sort((a, b) => a.tier - b.tier || a.d.name.localeCompare(b.d.name))
    .map((x) => x.d);
}
