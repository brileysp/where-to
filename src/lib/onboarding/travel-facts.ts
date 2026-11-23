/**
 * The place-side data behind "What else matters when you choose?" (10 Nov 2026): what each place offers a traveler with kids, a language, a dietary need,
 * a mobility need or a way of traveling. Ratings are 0 to 10 (src/lib/admin/travel-needs/config.ts); the keys here are the same column keys.
 * A place with no entry, or a rating that is missing, is never marked down for it (docs/matching-model.md: no data is a pass).
 */
export interface TravelPlaceFacts {
  kidsUnder5?: number;
  kids5to12?: number;
  kidsTeens?: number;
  fmtRoad?: number;
  fmtTour?: number;
  fmtCruise?: number;
  fmtBase?: number;
  englishEase?: number;
  localLanguages?: string[];
  dietVegetarian?: number;
  dietVegan?: number;
  dietGlutenFree?: number;
  dietHalal?: number;
  dietKosher?: number;
  accessMobility?: number;
  accessWheelchair?: number;
}

export type TravelFacts = Record<string, TravelPlaceFacts>;

const NUM_KEYS = ['kidsUnder5', 'kids5to12', 'kidsTeens', 'fmtRoad', 'fmtTour', 'fmtCruise', 'fmtBase', 'englishEase', 'dietVegetarian', 'dietVegan', 'dietGlutenFree', 'dietHalal', 'dietKosher', 'accessMobility', 'accessWheelchair'] as const;

/** Keeps only the known columns, numbers as numbers, so a stray value in the database cannot reach the ranking. */
export function cleanTravelFacts(raw: Record<string, unknown>): TravelPlaceFacts {
  const out: TravelPlaceFacts = {};
  for (const k of NUM_KEYS) { const v = raw[k]; if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10) out[k] = v; }
  if (Array.isArray(raw.localLanguages)) out.localLanguages = raw.localLanguages.filter((x): x is string => typeof x === 'string');
  return out;
}
