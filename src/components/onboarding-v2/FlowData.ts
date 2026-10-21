import type { ScoredDestination } from '@/lib/scoring/types';
import type { DimensionDef, DnaCard, DomainDef } from '@/lib/dna/types';
import type { OnboardingChip } from '@/lib/db/queries/onboarding-chips';
import type { PlaceCoords } from '@/lib/onboarding/shortlist';
import type { MatchSetups } from '@/lib/onboarding/live-types';
import type { MatchSettings } from '@/lib/scoring/matchSettings';

/** Everything the flow needs from the server. */
export interface FlowData {
  chips: Record<string, OnboardingChip[]>;
  destinations: ScoredDestination[];
  cards: DnaCard[];
  domains: DomainDef[];
  dimensions: DimensionDef[];
  emojiOverrides: Record<string, string>;
  shortNames: Record<string, string>;
  /** Place coordinates, for flight limits. A place without an entry is never set aside. */
  coords: Record<string, PlaceCoords>;
  /** The approved questions and chips for the interests that have them (see lib/db/queries/match-data.ts). */
  setups: MatchSetups;
  /** How much a place keeps when a chip or answer misses (the admin's Matching tab). */
  matchSettings: MatchSettings;
}
