import {
  pgTable,
  text,
  smallint,
  boolean,
  jsonb,
  uuid,
  integer,
  doublePrecision,
  timestamp,
  primaryKey,
  pgEnum,
  index,
  uniqueIndex,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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

export const crowdBaselineEnum = pgEnum('crowd_baseline', ['low', 'high']);

export const severityEnum = pgEnum('severity', ['mild', 'moderate', 'severe']);

export const cardStageEnum = pgEnum('card_stage', ['broad', 'deep']);

export const swipeTypeEnum = pgEnum('swipe_type', ['no', 'yes', 'love']);

export const adminAuditActionEnum = pgEnum('admin_audit_action', ['create', 'update', 'delete']);

// ---- Global / shared content -------------------------------------------------
// Everything below is read-only at runtime (write access reserved for the
// content-import script). PREFERENCE_ATTRIBUTES, SLIDERS, PERSONAS,
// BAND_DIMENSIONS, INTEREST_EMOJIS and
// DOMAIN_NUANCE_TEMPLATES stay as TypeScript code (see lib/dna, lib/scoring)
// rather than tables — they're tightly coupled to the code that reads them.


// ---- Place migration (docs/final-architecture-plan.md) --------------------
// Migration complete as of 2026-09-07: `places` fully superseded the old
// flat `destinations` table (Phase 4's admin+public cutover, then Phase 6's
// table drop) — there is no `destinations` table anymore. See
// place_migration_status memory for the phase-by-phase history. See the doc's
// "Recommended Data Model" section below for the full
// rationale behind every column/constraint below.

export const placeRelationshipTypeEnum = pgEnum('place_relationship_type', [
  'nearby',
  'day_trip',
  'gateway_to',
  'commonly_combined',
  'alternative_to',
]);

export const places = pgTable(
  'places',
  {
    id: text('id').primaryKey(), // slug, same convention as destinations.id
    name: text('name').notNull(),
    region: text('region').notNull(),
    emoji: text('emoji').notNull(),
    climate: climateEnum('climate').notNull(),
    // See the destinations.placeType comment above — same field, same
    // caveats (plain text, taxonomy not yet locked to an enum).
    placeType: text('place_type'),
    about: text('about').notNull(),
    overview: text('overview'),

    costMin: text('cost_min'),
    costMax: text('cost_max'),
    costOverview: text('cost_overview'),
    costItems: jsonb('cost_items').notNull().default([]).$type<
      Array<{ label: string; price: number; unit: string; emoji?: string }>
    >(),

    baseScores: jsonb('base_scores').notNull().$type<Record<string, number>>(),

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
    noSnowMonths: smallint('no_snow_months').array().notNull().default([]),

    sliderCaps: jsonb('slider_caps').notNull().default({}).$type<Record<string, number>>(),
    sliderEvents: jsonb('slider_events')
      .notNull()
      .default({})
      .$type<Record<string, { label: string; weight: number; months: Record<string, number> }[]>>(),

    peakIntensity: peakIntensityEnum('peak_intensity'),
    crowdBaseline: crowdBaselineEnum('crowd_baseline'),
    hotSeverity: severityEnum('hot_severity'),
    coldSeverity: severityEnum('cold_severity'),
    wetSeverity: severityEnum('wet_severity'),

    seasonalHazards: jsonb('seasonal_hazards').notNull().default([]).$type<
      Array<{
        category: 'storm' | 'airQuality' | 'insects' | 'seaweed' | 'other';
        label: string;
        months: number[];
        severity: 'mild' | 'moderate' | 'severe';
        affectedSliders: string[];
      }>
    >(),

    // Destination-level "current conditions" advisories (security, active
    // deforestation/poaching, access disruptions) — deliberately NOT keyed
    // by slider and NOT read by the scoring engine, unlike seasonalHazards
    // above. These affect a visitor's experience across every interest at
    // once, so they're authored and shown once per destination rather than
    // duplicated into (or orphaned out of) individual sliderOverview text.
    travelAdvisories: jsonb('travel_advisories').notNull().default([]).$type<
      Array<{
        category: 'security' | 'environmental' | 'access' | 'health' | 'other';
        severity: 'moderate' | 'serious';
        text: string;
        lastReviewed: string; // ISO date, e.g. "2026-03-01"
      }>
    >(),

    shopClosures: boolean('shop_closures').notNull().default(false),
    specialSeasons: jsonb('special_seasons').notNull().default([]).$type<
      Array<{ months: number[]; text: string }>
    >(),
    monthlyWeather: text('monthly_weather').array(),

    // Per-interest analogues of overview/monthlyWeather above — "why does
    // this month score the way it does, for THIS interest" rather than
    // for the destination overall. Both keyed by slider id; sliderOverview
    // holds one non-seasonal summary per slider, sliderMonthlyWeather
    // holds up to 12 entries per slider (null = no authored text yet for
    // that month, matching monthlyWeather's own null-slot convention).
    sliderOverview: jsonb('slider_overview').notNull().default({}).$type<Record<string, string>>(),
    sliderMonthlyWeather: jsonb('slider_monthly_weather')
      .notNull()
      .default({})
      .$type<Record<string, (string | null)[]>>(),

    searchAliases: text('search_aliases').array().notNull().default([]),
    naSliders: text('na_sliders').array().notNull().default([]),
    budgetBands: text('budget_bands').array().notNull().default([]),
    vibeBands: text('vibe_bands').array().notNull().default([]),
    physicalBands: text('physical_bands').array().notNull().default([]),
    audienceBands: text('audience_bands').array().notNull().default([]),

    activityStyleTiers: jsonb('activity_style_tiers').notNull().default({}).$type<
      Record<string, Record<string, 'signature' | 'strong' | 'casual' | 'none'>>
    >(),
    signatureTier: jsonb('signature_tier').notNull().default({}).$type<
      Record<string, 'signature' | 'strong' | 'casual' | 'none'>
    >(),
    scoreOverrides: jsonb('score_overrides').notNull().default({}).$type<
      Record<string, Record<number, number>>
    >(),

    // Curve-based scoring, Phase 1 (docs/scoring-v2-proposal.html) — same
    // column, same rationale as destinations.sliderCurves above. Fitted
    // independently from this table's OWN current monthly output, not
    // copied from destinations — see scripts/backfill-slider-curves.ts's
    // doc comment for why (this table isn't guaranteed to still mirror
    // destinations' content exactly; treating each table's own live
    // formula output as the source of truth for its own fit avoids
    // silently introducing a new cross-table inconsistency).
    sliderCurves: jsonb('slider_curves')
      .notNull()
      .default({})
      .$type<Record<string, { anchors: Array<{ month: number; value: number; steepness?: number }> }>>(),

    /**
     * Slider keys whose `sliderCurves` entry is HAND-AUTHORED and must not
     * be regenerated from the formula.
     *
     * The curve migration (docs/scoring-v2-proposal.html) moved the read
     * path onto curves but never built the authoring half, so every curve
     * is still fitted from deriveDestinationScores on every write — which
     * means the old formula, flat +7 peak bonus and all, is still the
     * source of truth, and any hand-edited curve is destroyed on the next
     * save. This column is what lets a curve stop being derived.
     *
     * Deliberately a per-slider list rather than a per-destination flag:
     * migration is gradual, so one destination can have an authored
     * hiking curve while its other 52 sliders stay derived. When every
     * curve is authored this column and the refit both retire together.
     */
    authoredCurves: text('authored_curves').array().notNull().default([]),

    // ---- New in Phase 1 ----
    // Strict geographic containment only, one parent, forms a tree (never
    // a graph) — cycle prevention is an application-level ancestor-walk
    // check on every parent-assignment write, not a database constraint.
    parentPlaceId: text('parent_place_id').references((): AnyPgColumn => places.id),
    // A place with isPrimaryDestination=true is eligible for the main
    // ranking engine, shown in Recommendations, and expected to carry full
    // About/Costs content. Independent of isPublished — a place can be
    // primary-eligible while still being authored.
    isPrimaryDestination: boolean('is_primary_destination').notNull().default(false),
    isPublished: boolean('is_published').notNull().default(false),
    // The short "why" line a related place needs instead of full
    // About/Costs tabs (which stay properties of the parent destination).
    summary: text('summary'),
    // The five-state score model (explicit/inherited/calculated, plus
    // naSliders for not-applicable and plain absence for missing) — see
    // "Explicit vs. inherited vs. calculated..." in
    // docs/final-architecture-plan.md. Sparse: a key present in
    // baseScores but absent here simply hasn't been classified yet
    // (true of every one of today's 200 destinations, pre-migration).
    scoreStatus: jsonb('score_status').notNull().default({}).$type<
      Record<string, 'explicit' | 'inherited' | 'calculated'>
    >(),
    // Only meaningful where scoreStatus[key] === 'inherited' — names the
    // source placeId a value was copied from, so an inherited score is
    // always traceable and never presented as independently researched.
    scoreInheritedFrom: jsonb('score_inherited_from').notNull().default({}).$type<Record<string, string>>(),
    // ISO 3166-1 alpha-3 (e.g. "CRI") — matches the stamp badge display
    // and common map-boundary datasets. Nullable until backfilled.
    countryCode: text('country_code'),
    // Prefer deriving from countryCode via a static code-level lookup
    // (see src/lib/scoring/continents.ts) rather than hand-authoring per
    // row — a deterministic fact about the country, not an editorial call.
    continent: text('continent'),
    // A postal/subdivision abbreviation — USPS two-letter for US states,
    // each country's own convention otherwise.
    regionLabel: text('region_label'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    // The canonical shape/color/style for this place's passport stamp.
    // Nullable — meant to have a deterministic algorithmic default rather
    // than requiring 200+ hand-curated designs before shipping.
    stampDesign: jsonb('stamp_design'),

    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('places_parent_not_self', sql`${table.parentPlaceId} IS NULL OR ${table.parentPlaceId} <> ${table.id}`),
    index('places_parent_place_id_idx').on(table.parentPlaceId),
    // Partial index — keeps the main ranking query fast once this table
    // holds thousands of related places alongside a few hundred primary
    // ones (see docs/final-architecture-plan.md's index notes).
    index('places_primary_destination_idx').on(table.isPrimaryDestination).where(sql`${table.isPrimaryDestination}`),
  ],
);

export const placeRelationships = pgTable(
  'place_relationships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromPlaceId: text('from_place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'restrict' }),
    toPlaceId: text('to_place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'restrict' }),
    relationshipType: placeRelationshipTypeEnum('relationship_type').notNull(),
    note: text('note'),
    weight: integer('weight'),
  },
  (table) => [
    uniqueIndex('place_relationships_unique_idx').on(table.fromPlaceId, table.toPlaceId, table.relationshipType),
    check('place_relationships_not_self', sql`${table.fromPlaceId} <> ${table.toPlaceId}`),
    index('place_relationships_from_idx').on(table.fromPlaceId),
    index('place_relationships_to_idx').on(table.toPlaceId),
  ],
);

// Polymorphic across content types that don't all exist yet ('tour'/'stay'
// reserved) — itemId is validated against the right table in application
// code, the same boundary-validation pattern already used for naSliders
// and cardSubdimensions elsewhere in this schema, not a real foreign key.
export const userHearts = pgTable(
  'user_hearts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    itemType: text('item_type').notNull(), // 'place' today; 'tour' | 'stay' reserved
    itemId: text('item_id').notNull(),
  },
  (table) => [
    uniqueIndex('user_hearts_unique_idx').on(table.userId, table.itemType, table.itemId),
    index('user_hearts_user_id_idx').on(table.userId),
    index('user_hearts_item_idx').on(table.itemType, table.itemId),
  ],
);

// `id` is a generated primary key, not a composite (userId, placeId) key,
// specifically so more than one stamp per place is structurally possible
// later without a breaking migration — even though MVP behavior only ever
// inserts one row per user per place today.
export const userStamps = pgTable(
  'user_stamps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    placeId: text('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    visitedAt: timestamp('visited_at', { withTimezone: true }).notNull().defaultNow(),
    // This specific stamp's rotation/opacity/smudge, generated once at row
    // creation and never regenerated on view.
    stampRender: jsonb('stamp_render'),
  },
  (table) => [index('user_stamps_user_place_idx').on(table.userId, table.placeId)],
);

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

  // Admin-authoring concurrency guard (see docs/admin-panel-plan.md) — the
  // column is added now because it's free, even though the optimistic-lock
  // check itself (WHERE ... AND updated_at = :loaded) isn't enforced until
  // more than one admin can write at once. Also just a useful "last edited"
  // timestamp for the admin UI in the meantime.
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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

// ---- Admin authoring ---------------------------------------------------------
// See docs/admin-panel-plan.md — the safety net behind every admin write.
// `entityType`/`entityId` are polymorphic (validated in application code, not
// a real FK) across every admin-manageable table, the same pattern userHearts
// (planned) uses for itemType/itemId. Append-only: nothing ever updates or
// deletes a row here — undo is implemented by writing a new row that replays
// an old beforeValue, never by editing history.
export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Plain uuid for now, the real Supabase Auth user id from requireAdminUser()
    // (src/lib/admin/auth.ts) — not a DB-level FK to auth.users(id), matching
    // the same "no local auth.users table in PGlite" boundary userSwipes.userId
    // etc. already live with.
    actorId: uuid('actor_id').notNull(),
    entityType: text('entity_type').notNull(), // 'card' | 'destination' | ...
    entityId: text('entity_id').notNull(),
    action: adminAuditActionEnum('action').notNull(),
    beforeValue: jsonb('before_value'), // full row snapshot; null on create
    afterValue: jsonb('after_value'), // full row snapshot; null on delete
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('admin_audit_log_entity_idx').on(table.entityType, table.entityId, table.createdAt)],
);

// SLIDERS (key/label/domain/formula) stays TypeScript code — see the
// comment at the top of this file — it's load-bearing for the scoring
// engine and shouldn't move to the database piecemeal. This table holds
// only admin-editable *overrides* on top of that code-defined data,
// starting with emoji (see getInterestEmoji in lib/scoring/interestMeta.ts).
// A slider key with no row here just uses SLIDERS[key].icon unchanged.
export const interestMeta = pgTable('interest_meta', {
  key: text('key').primaryKey(), // matches a SLIDERS[].key
  emoji: text('emoji'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
