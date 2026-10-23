import type { InterestFactors } from '@/lib/scoring/rank';
import type { MatchSettings } from '@/lib/scoring/matchSettings';
import { matchFromFits, type PlaceMatchFits } from '@/lib/scoring/matchTable';
import type { MatchReason } from '@/lib/scoring/personalMatch';
import type { InterestAnswers } from './profile';
import type { MatchSetups } from './live-types';

/**
 * What the traveler's chips and answers do to every place's score, interest by interest (docs/matching-model.md). Feeds the ranking
 * (`factors`) and the place sheet (`notes`: the reasons for a drop and the chips a place matches fully).
 */

export type MatchFitsByInterest = Record<string, Record<string, PlaceMatchFits>>;

export interface PlaceNote {
  /** What this interest keeps of the place's score, 0.3 to 1. */
  factor: number;
  reasons: MatchReason[];
  matches: string[];
}

export interface LiveMatch {
  factors: InterestFactors;
  /** Place id, then interest key. Only interests the traveler has changed something for. */
  notes: Record<string, Record<string, PlaceNote>>;
}

export function liveMatch(args: {
  /** The interests the traveler has (picked or added). */
  interests: readonly string[];
  setups: MatchSetups;
  fits: MatchFitsByInterest;
  /** Ticked chips per interest. */
  ticked: Record<string, string[]>;
  qa: InterestAnswers;
  /** The month the traveler is going, 0 = January; null when none is chosen. */
  month?: number | null;
  settings?: MatchSettings;
}): LiveMatch {
  const factors: InterestFactors = {};
  const notes: LiveMatch['notes'] = {};
  for (const k of args.interests) {
    const setup = args.setups[k];
    const perPlace = args.fits[k];
    if (!setup || !perPlace) continue;
    const ticked = args.ticked[k] ?? [];
    const answers = args.qa[k] ?? {};
    if (ticked.length === 0 && Object.keys(answers).length === 0) continue;
    for (const [placeId, fits] of Object.entries(perPlace)) {
      const m = matchFromFits({ content: setup.content, fits, ticked, answers, month: args.month, settings: args.settings });
      if (m.factor < 0.999999) (factors[placeId] ??= {})[k] = m.factor;
      if (m.factor < 0.999999 || m.matches.length) (notes[placeId] ??= {})[k] = { factor: m.factor, reasons: m.reasons, matches: m.matches };
    }
  }
  return { factors, notes };
}
