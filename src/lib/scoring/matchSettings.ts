/**
 * The numbers behind personalization (docs/matching-model.md). Every one is something a traveler's chips or answers can take away from a place's
 * original score, written as "what the place keeps". They live in one place, can be changed in the admin (Matching tab) without a deploy, and the
 * database only stores what was changed. A place is never pushed above its original score.
 */

export interface MatchSettings {
  /** The traveler ticked chips and the place has none of them (rating 0): it keeps this share of the interest's score. A chip is a wall: you came for it. */
  keepIfChipMissed: number;
  /** A chip rating at or above this counts as a full match. */
  chipFullMatchRating: number;
  /** A Limit answer (safety, skill, rules, weather you cannot stand) is completely missed: the place keeps this share. */
  keepIfLimitMissed: number;
  /** A Lean answer (a preference) is completely missed: the place keeps this share. */
  keepIfLeanMissed: number;
  /** However many things are missed, an interest never keeps less than this share of its original score. */
  interestFloor: number;
  /** A miss that takes off at least this share gets a reason chip on the place card. */
  reasonThreshold: number;
  /** Most reason chips per place card. */
  maxReasons: number;
}

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  keepIfChipMissed: 0.5,
  chipFullMatchRating: 7,
  keepIfLimitMissed: 0.5,
  keepIfLeanMissed: 0.85,
  interestFloor: 0.3,
  reasonThreshold: 0.15,
  maxReasons: 2,
};

export interface MatchSettingField {
  key: keyof MatchSettings;
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  /** Shown as a percent (the value is stored as 0 to 1). */
  percent: boolean;
}

/** What the admin screen shows, in order. Plain language: each of these is how much a place keeps, so a lower number is harsher. */
export const MATCH_SETTING_FIELDS: MatchSettingField[] = [
  { key: 'keepIfChipMissed', label: 'Has none of the chips you ticked', help: 'The place keeps this much of its score for that interest when it offers nothing you ticked. If you ticked only "Big mountain climbs" and it has none.', min: 0.1, max: 1, step: 0.05, percent: true },
  { key: 'chipFullMatchRating', label: 'A chip rating that counts as a full match', help: 'Chips are rated 0 to 10 per place. At or above this the place keeps all of its score; below it the loss grows as the rating falls.', min: 3, max: 10, step: 0.5, percent: false },
  { key: 'keepIfLimitMissed', label: 'Misses a Limit answer', help: 'Limits are safety, skill, rules and weather you cannot stand: a certification, altitude, water too cold, bathing customs. One miss should decide a place.', min: 0.1, max: 1, step: 0.05, percent: true },
  { key: 'keepIfLeanMissed', label: 'Misses a Lean answer', help: 'Leans are preferences: left or right waves, apres-ski, the animals you hope for. Several of them add up slowly and should never bury a place.', min: 0.5, max: 1, step: 0.05, percent: true },
  { key: 'interestFloor', label: 'Never keeps less than', help: 'However many things are missed, an interest keeps at least this much of its original score.', min: 0.1, max: 0.9, step: 0.05, percent: true },
  { key: 'reasonThreshold', label: 'Show a reason chip when a miss takes off at least', help: 'Smaller losses are applied quietly with no chip.', min: 0.05, max: 0.5, step: 0.05, percent: true },
  { key: 'maxReasons', label: 'Most reason chips on a place card', help: 'The biggest losses are shown first.', min: 1, max: 4, step: 1, percent: false },
];

export type MatchSettingsOverride = Partial<Record<keyof MatchSettings, number>>;

/** Keeps only valid numbers inside each field's range; anything else falls back to the default. */
export function mergeMatchSettings(override: unknown): MatchSettings {
  const out: MatchSettings = { ...DEFAULT_MATCH_SETTINGS };
  if (!override || typeof override !== 'object') return out;
  for (const f of MATCH_SETTING_FIELDS) {
    const v = (override as Record<string, unknown>)[f.key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= f.min && v <= f.max) out[f.key] = v;
  }
  out.maxReasons = Math.round(out.maxReasons);
  return out;
}

/** The first problem with a set of numbers, or null. The floor must sit below what a full miss keeps, or the floor would hide the difference. */
export function matchSettingsProblem(s: MatchSettings): string | null {
  for (const f of MATCH_SETTING_FIELDS) {
    const v = s[f.key];
    if (!Number.isFinite(v) || v < f.min || v > f.max) return `${f.label}: use a number from ${f.percent ? Math.round(f.min * 100) + '%' : f.min} to ${f.percent ? Math.round(f.max * 100) + '%' : f.max}`;
  }
  if (s.interestFloor > Math.min(s.keepIfChipMissed, s.keepIfLimitMissed)) return 'The floor cannot be higher than what a place keeps for a missed chip or Limit, or those misses would make no difference';
  return null;
}
