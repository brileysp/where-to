import {
  pgTable,
  text,
  smallint,
  boolean,
  jsonb,
  uuid,
  integer,
  timestamp,
  primaryKey,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ---- Enums -----------------------------------------------------------------

export const climateEnum = pgEnum('climate', [
  'tropical',
  'desert',
  'mediterranean',
  'temperate',
  'highland',
  'polar',
]);

export const peakIntensityEnum = pgEnum('peak_intensity', ['mild', 'moderate', 'extreme']);

export const cardStageEnum = pgEnum('card_stage', ['broad', 'deep']);

export const swipeTypeEnum = pgEnum('swipe_type', ['no', 'yes', 'love']);

// ---- Global / shared content -------------------------------------------------
// Everything below is read-only at runtime (write access reserved for the
// content-import script). PREFERENCE_ATTRIBUTES, SLIDERS, PERSONAS,
// BAND_DIMENSIONS, INTEREST_EMOJIS and
// DOMAIN_NUANCE_TEMPLATES stay as TypeScript code (see lib/dna, lib/scoring)
// rather than tables — they're tightly coupled to the code that reads them.

export const destinations = pgTable('destinations', {
  id: text('id').primaryKey(), // slug, e.g. 'bali' — ported directly from data.js ids
  name: text('name').notNull(),
  region: text('region').notNull(),
  emoji: text('emoji').notNull(),
  climate: climateEnum('climate').notNull(),
  // The seasonal-pattern summary, always shown above the month chart.
  about: text('about').notNull(),
  // One-sentence evergreen "why go here" pitch for the About tab. Nullable
  // — destinations without it yet fall back to `about` in the UI.
  overview: text('overview'),

  // Regional cost floor/ceiling, $–$$$$$ — two plain columns rather than
  // one jsonb object since these are the two ends of an ordinal scale, not
  // a free-form structure. Both null = no cost data authored yet, and the
  // UI hides the cost pill/tab entirely rather than showing a fake range.
  costMin: text('cost_min'),
  costMax: text('cost_max'),
  // One-sentence texture on what costs are actually like for a traveler
  // here — shown on the Cost tab above the itemized price list. Distinct
  // from `overview`: this is "what does spending here feel like", not
  // "why go here at all".
  costOverview: text('cost_overview'),
  // Real one-time (or genuine per-day-rate) prices, author-sorted low to
  // high — see docs/content/cost-scoring-methodology.md. Sparse jsonb
  // array like specialSeasons below, not normalized rows: read generically
  // per destination, never SQL-filtered.
  costItems: jsonb('cost_items').notNull().default([]).$type<
    Array<{ label: string; price: number; unit: string }>
  >(),

  // The 27-key interest score object (data.js `base`). JSONB: read
  // generically by deriveDestinationScores, never SQL-filtered.
  baseScores: jsonb('base_scores').notNull().$type<Record<string, number>>(),

  // Month-fact arrays (1-12). Direct port of data.js's month-number arrays.
  dryMonths: smallint('dry_months').array().notNull().default([]),
  wetMonths: smallint('wet_months').array().notNull().default([]),
  hotMonths: smallint('hot_months').array().notNull().default([]),
  coldMonths: smallint('cold_months').array().notNull().default([]),
  peakMonths: smallint('peak_months').array().notNull().default([]),
  lowMonths: smallint('low_months').array().notNull().default([]),
  wildlifePeakMonths: smallint('wildlife_peak_months').array().notNull().default([]),
  wildlifeClosedMonths: smallint('wildlife_closed_months').array().notNull().default([]),
  birdingPeakMonths: smallint('birding_peak_months').array().notNull().default([]),
  hikingBestMonths: smallint('hiking_best_months').array().notNull().default([]),
  hikingWorstMonths: smallint('hiking_worst_months').array().notNull().default([]),
  inaccessibleMonths: smallint('inaccessible_months').array().notNull().default([]),
  swimHazardMonths: smallint('swim_hazard_months').array().notNull().default([]),
  // See the `noSnow` comment in scoring/types.ts — a hard floor for "no
  // snow on the ground this month", independent of the generic hot/dry
  // weather flags a ski destination's mild summer may never trigger.
  noSnowMonths: smallint('no_snow_months').array().notNull().default([]),
  // See the `sliderCaps` comment in scoring/types.ts — sparse per-slider
  // ceiling, e.g. { wildlife: 4 }, for destinations whose peak-month
  // score would otherwise overstate how genuinely good they are.
  sliderCaps: jsonb('slider_caps').notNull().default({}).$type<Record<string, number>>(),
  // See the `SliderEvent` comment in scoring/types.ts — sparse per-slider
  // list of named seasonal drivers with their own weight + month intensity,
  // for destinations whose seasonality is more than a single peak flag can
  // express (a genuine shoulder season, or two independently-weighted
  // draws like bears and belugas).
  sliderEvents: jsonb('slider_events')
    .notNull()
    .default({})
    .$type<Record<string, { label: string; weight: number; months: Record<string, number> }[]>>(),

  peakIntensity: peakIntensityEnum('peak_intensity'),

  // NOTE: this is a boolean flag in the legacy app (data.js:286,371,422,468),
  // not a month array — combined with `low_months` at read time. Confirmed
  // via direct code read; a real migration bug to avoid.
  shopClosures: boolean('shop_closures').notNull().default(false),

  // Ragged array of { months: number[], text: string } — correctly JSONB.
  specialSeasons: jsonb('special_seasons').notNull().default([]).$type<
    Array<{ months: number[]; text: string }>
  >(),

  // Hand-written per-month weather prose, index 0 = January.
  monthlyWeather: text('monthly_weather').array(),

  searchAliases: text('search_aliases').array().notNull().default([]),
  naSliders: text('na_sliders').array().notNull().default([]),
  budgetBands: text('budget_bands').array().notNull().default([]),
  vibeBands: text('vibe_bands').array().notNull().default([]),
  physicalBands: text('physical_bands').array().notNull().default([]),

  // Per-slider sub-style quality, e.g. { cycling: { mountainBiking:
  // 'signature', scenicRoadCycling: 'casual' } } — keyed by the same
  // slider keys (SLIDERS in scoring/constants.ts) and the same DNA
  // attribute keys a resolved core-axis branch produces (see
  // DOMAIN_CORE_AXES in lib/dna/domains.ts), so no separate vocabulary is
  // needed between the DNA engine and destination content. A slider with
  // no entry here, or a style tier not tiered for a destination, is
  // treated as if every relevant style were absent (see TIER_MULTIPLIERS
  // in scoring/rank.ts) — sparse by design, not required for every
  // destination/slider pair.
  activityStyleTiers: jsonb('activity_style_tiers').notNull().default({}).$type<
    Record<string, Record<string, 'signature' | 'strong' | 'casual' | 'none'>>
  >(),
});

export const domains = pgTable('domains', {
  key: text('key').primaryKey(), // e.g. 'Birding' — the whole app addresses domains by this string
  // Legacy "future domain" stubs (23 of the 27 today) only ever defined
  // `key` — no label/emoji. Migration falls back label to the key itself
  // (already human-readable, e.g. 'Wildlife Photography'); emoji has no
  // sensible fallback so stays nullable.
  label: text('label').notNull(),
  emoji: text('emoji'),
  hasDeepCards: boolean('has_deep_cards').notNull().default(false),
  matchCategories: text('match_categories').array().notNull().default([]),
  matchTags: text('match_tags').array().notNull().default([]),
  unlockMinPositive: integer('unlock_min_positive'),
  unlockMinLove: integer('unlock_min_love'),
  transitionTitle: text('transition_title'),
  transitionBody: text('transition_body'),
});

export const subdimensions = pgTable('subdimensions', {
  id: uuid('id').primaryKey().defaultRandom(),
  domainKey: text('domain_key')
    .notNull()
    .references(() => domains.key),
  name: text('name').notNull(),
  // Preserves the round-robin queue order buildDeepDiveQueue depends on.
  ordinal: integer('ordinal').notNull().default(0),
});

export const cards = pgTable('cards', {
  id: text('id').primaryKey(),
  short: text('short').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  tags: text('tags').array().notNull().default([]),
  imagePrompt: text('image_prompt'),

  // Sparse { attribute: smallInt } maps, read generically via
  // Object.entries() in applySwipeToProfile / alignmentScore. No SQL
  // filtering needed, so JSONB over normalized rows.
  preferenceSignals: jsonb('preference_signals').notNull().default({}).$type<
    Record<string, number>
  >(),
  dimensionSignals: jsonb('dimension_signals').notNull().default({}).$type<
    Record<string, number>
  >(),

  stage: cardStageEnum('stage').notNull().default('broad'),
  domainKey: text('domain_key').references(() => domains.key),

  // True for cards whose content requires a specific niche hobby/skill or
  // depicts something near-universally extreme/unappealing (e.g. a
  // technical mountain-bike descent, a packaged tourist-photo-op tour) —
  // most people would swipe "no" on these regardless of their real
  // position on whatever dimension/tension the card is tagged with, so a
  // reject carries almost no information about the general trait. Only
  // read at the reject-evidence layer (see src/lib/dna/evidence.ts):
  // never excludes a card from ordinary selection/scoring, and a love/like
  // on a niche card still counts as normal (arguably stronger) positive
  // evidence — the discount is specifically for what a "no" is allowed to
  // prove.
  niche: boolean('niche').notNull().default(false),

  // Free-text subdimension names, validated against the subdimensions table
  // by the import script rather than a DB FK — keeps the authoring format a
  // plain JSON array of strings.
  cardSubdimensions: text('card_subdimensions').array(),
  sampleDestinations: text('sample_destinations').array(),
  unlockMinPositive: integer('unlock_min_positive'),
  unlockMinLove: integer('unlock_min_love'),
  diagnosticPurpose: text('diagnostic_purpose'),
});

export const dimensions = pgTable('dimensions', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  poleA: text('pole_a').notNull(),
  poleB: text('pole_b').notNull(),
  keyA: text('key_a').notNull(),
  keyB: text('key_b').notNull(),
  summaryA: text('summary_a').notNull(),
  summaryB: text('summary_b').notNull(),
  question: text('question').notNull(),
});

export const tensions = pgTable('tensions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  insightText: text('insight_text').notNull(),
  recommendationImplication: text('recommendation_implication'),
  relatedDimensionIds: text('related_dimension_ids').array().notNull().default([]),
  signalA: jsonb('signal_a').notNull().$type<{
    label: string;
    type: 'profile' | 'dimensionPole' | 'rejectedAttrs';
    keys: string[];
    min: number;
  }>(),
  signalB: jsonb('signal_b').notNull().$type<{
    label: string;
    type: 'profile' | 'dimensionPole' | 'rejectedAttrs';
    keys: string[];
    min: number;
  }>(),
});

// ---- User-scoped content ----------------------------------------------------
// `userId` will become a real FK to Supabase's `auth.users(id)` (with RLS
// policies keyed on auth.uid()) once Phase 5 wires up Supabase Auth. Kept as
// a plain uuid column for now — no local `auth.users` table exists yet since
// local dev runs on PGlite, not a full Supabase stack. This is the
// "lay the foundation, don't build the login feature yet" boundary.

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // will reference auth.users(id) on Supabase
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userSwipes = pgTable('user_swipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  cardId: text('card_id')
    .notNull()
    .references(() => cards.id),
  swipeType: swipeTypeEnum('swipe_type').notNull(),
  sessionId: uuid('session_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userDnaState = pgTable('user_dna_state', {
  userId: uuid('user_id').primaryKey(),
  // The whole dnaState object minus swipes (which live in user_swipes above),
  // stored as one versioned JSONB document — matches how it's already
  // read/written today (traveldna.js's loadDNAState/saveDNAState).
  state: jsonb('state').notNull(),
  version: text('version').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Main-app slider/persona/band/month state — the DB-backed replacement for
// the legacy app's localStorage keys (whereto.persona/weights/bands/month/
// monthchosen/showall.v2). One row per user, always upserted as a whole.
export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id').primaryKey(),
  personaId: text('persona_id'),
  weights: jsonb('weights').notNull().$type<Record<string, number>>(),
  bands: jsonb('bands').notNull().$type<Record<string, string[]>>(),
  month: integer('month'),
  monthChosen: boolean('month_chosen').notNull().default(false),
  showAllSliders: boolean('show_all_sliders').notNull().default(false),

  // Sub-style pills "earned" by resolving a DNA core axis (see
  // resolveEarnedStyles in lib/dna/domains.ts), keyed by slider key —
  // e.g. { cycling: ['mountainBiking', 'gravelRiding'] }. Written once at
  // applyTravelDNAWeights time; not user-editable directly.
  earnedStyles: jsonb('earned_styles').notNull().default({}).$type<Record<string, string[]>>(),
  // Which of the earned pills are currently toggled on, scoping what a
  // slider's destination score is computed from (see TIER_MULTIPLIERS in
  // scoring/rank.ts). Defaults to all-earned-selected; user-toggleable.
  selectedStyles: jsonb('selected_styles').notNull().default({}).$type<Record<string, string[]>>(),

  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userSavedProfiles = pgTable('user_saved_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  name: text('name').notNull(),
  weights: jsonb('weights').notNull().$type<Record<string, number>>(),
  bands: jsonb('bands').notNull().$type<Record<string, string[]>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const travelDnaSnapshots = pgTable('travel_dna_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  profile: jsonb('profile').notNull().$type<Record<string, number>>(),
  dimensionState: jsonb('dimension_state').notNull(),
  confirmedInsights: jsonb('confirmed_insights').notNull().default([]),
  label: text('label'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
