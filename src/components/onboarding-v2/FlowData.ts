import type { ScoredDestination } from '@/lib/scoring/types';
import type { DimensionDef, DnaCard, DomainDef } from '@/lib/dna/types';
import type { OnboardingChip } from '@/lib/db/queries/onboarding-chips';
import type { PlaceCoords } from '@/lib/onboarding/shortlist';
import type { MatchSetups } from '@/lib/onboarding/live-types';
import type { RegionKey } from '@/lib/onboarding/regions';
import type { MatchSettings } from '@/lib/scoring/matchSettings';
import type { TravelFacts } from '@/lib/onboarding/travel-facts';

/** Everything the flow needs from the server. */
export interface FlowData {
  /** What each place offers a traveler with kids, a language, a dietary need, a mobility need or a way of traveling (What else matters). */
  travelFacts: TravelFacts;
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
  /** Place id to its region (or null, for Antarctica), for the continents filter. */
  regions: Record<string, RegionKey | null>;
  /** Place id to its setting tags (what the place is like), for the kinds-of-place filter. */
  settingTags: Record<string, string[]>;
  /** How much a place keeps when a chip or answer misses (the admin's Matching tab). */
  matchSettings: MatchSettings;
}
