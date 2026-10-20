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
  date,
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

// ---- Content provenance ------------------------------------------------------

/** Who wrote a piece of interest content, and who last touched it — see
 * places.sliderOverviewMeta/sliderMonthlyWeatherMeta below for where this
 * lives. `origin` and `lastEditedBy` are deliberately separate fields, not
 * one "last touched by" value, so a chain like "Gemini-authored, then
 * corrected in a Claude expert review" stays representable instead of
 * collapsing into just "claude" and losing that it started as a
 * generation. */
export interface ContentStamp {
  origin: 'human' | 'claude' | 'gemini';
  /** Only set when origin === 'gemini' — links to the full generation
   * (prompt, raw response, validation) this stamp is a fast snapshot of. */
  originGenerationId?: string;
  lastEditedBy: 'human' | 'claude' | 'gemini';
  /** e.g. "brileysp@gmail.com" | "claude-sonnet-5" | "gemini-3.1-pro-preview" */
  lastEditorName: string;
  lastEditedAt: string;
  /** Human-readable, e.g. "Gemini reauthor" or "Corrected lynx timing — expert review". */
  lastChange?: string;
}

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
      Array<{
        label: string; price: number; unit: string; emoji?: string;
        // Edit tracking — see src/lib/admin/cost-item-stamp.ts. Admin-only.
        id?: string; updatedAt?: string | null; updatedBy?: string | null;
        editorKind?: 'human' | 'agent' | null; lastChange?: string | null;
        // Admin-only detail added Oct 2026; never sent to travellers.
        category?: 'lodging' | 'food' | 'transport' | 'activity' | 'other' | null; priceMax?: number | null;
        season?: 'year' | 'peak' | 'offPeak' | null; currency?: string | null; sourceUrl?: string | null; checkedOn?: string | null;
      }>
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
        sourceUrl?: string | null; // where the advisory comes from (added Oct 2026)
        expiresOn?: string | null; // date after which it should be re-checked or dropped
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

    // Who/what wrote sliderOverview/sliderMonthlyWeather, and who last
    // touched it — parallel columns, same keying as both (and the same
    // "record it, never compute from it" status as sliderSources below).
    // `origin` is who wrote it FIRST; `lastEditedBy` is who touched it MOST
    // RECENTLY — distinct on purpose so "Gemini-authored, then corrected in
    // a Claude expert review" is representable (origin: 'gemini',
    // lastEditedBy: 'claude'), not collapsed into a single "last touched by"
    // value that would lose the fact that it started as a generation.
    // `originGenerationId` links a gemini-origin stamp back to its full
    // content_generations row (prompt, raw response, validation) for
    // anyone who wants the deep history — this column only ever holds the
    // fast snapshot a grid renders without that join. Sparse and additive:
    // absence just means no stamp has been recorded yet (e.g. content
    // authored before this tracking existed), not that provenance is
    // unknown by policy.
    sliderOverviewMeta: jsonb('slider_overview_meta').notNull().default({}).$type<Record<string, ContentStamp>>(),
    sliderMonthlyWeatherMeta: jsonb('slider_monthly_weather_meta')
      .notNull()
      .default({})
      .$type<Record<string, (ContentStamp | null)[]>>(),

    // Provenance for sliderOverview/sliderMonthlyWeather/baseScores/
    // sliderEvents above — which external page(s) were actually consulted
    // to research or verify this slider's content/score for this
    // destination. Keyed by slider id, an ARRAY of sources per slider
    // (not one), since a real research pass routinely draws on more than
    // one page (a destination-specific article plus a species/phenomenon
    // reference, say) and a second pass later can add a corroborating or
    // superseding source without discarding the first. Deliberately NOT
    // read by the scoring engine — same "record it, never compute from
    // it" status as travelAdvisories above. Sparse: absence just means no
    // source has been logged yet for that slider, not that none exists.
    sliderSources: jsonb('slider_sources')
      .notNull()
      .default({})
      .$type<Record<string, Array<{ url: string; label?: string; note?: string; addedAt: string }>>>(),

    searchAliases: text('search_aliases').array().notNull().default([]),
    naSliders: text('na_sliders').array().notNull().default([]),
    // Why a place is not applicable for an interest, keyed by interest key (only for keys that are in naSliders). The
    // sentence Gemini gave, an imported one-line note, or the owner's own wording; `geminiText` keeps Gemini's original
    // when the owner has edited it. Never read by the scoring engine.
    naReasons: jsonb('na_reasons')
      .notNull()
      .default({})
      .$type<Record<string, { reason: string; source: 'gemini' | 'imported' | 'manual'; by: string; at: string; generationId?: string; geminiText?: string }>>(),
    budgetBands: text('budget_bands').array().notNull().default([]),
    vibeBands: text('vibe_bands').array().notNull().default([]),
    physicalBands: text('physical_bands').array().notNull().default([]),
    audienceBands: text('audience_bands').array().notNull().default([]),
    // Specialist ("gated") places: a gated place is left out of the traveller's results list unless their own weight for
    // one of `gatedInterests` reaches GATE_MIN_WEIGHT (src/lib/scoring/gating.ts). Searching for it always works.
    // Blank (false) by default; set from the admin Places tab.
    gated: boolean('gated').notNull().default(false),
    gatedInterests: text('gated_interests').array().notNull().default([]),
    // What the place is LIKE (city, island, desert…), 1–4 slugs from
    // src/lib/places/setting-tags.ts; first = primary. Distinct from the
    // single-valued, hierarchy-oriented `placeType` above.
    settingTags: text('setting_tags').array().notNull().default([]),

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
  // Home country (ISO code), which decides the units text is shown in: see src/lib/text/units.ts. Null = not chosen.
  homeCountry: text('home_country'),
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

/**
 * What a traveler saved from the new onboarding flow (docs/onboarding-v2/SPEC.md 6): interest levels and specifics, the Open-to bands, the
 * lasting "what matters" choices, who they travel with, home airport, photo picks and answers. One versioned document per user; only the
 * rows the traveler chose to keep are in it. The shape is src/lib/onboarding/profile.ts's TravelProfile.
 */
export const userTravelProfiles = pgTable('user_travel_profiles', {
  userId: uuid('user_id').primaryKey(),
  profile: jsonb('profile').notNull(),
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
  // The short name on the filter pills. Null = automatic (the text before " & ", see shortInterestLabel).
  shortName: text('short_name'),
  // Admin overrides of the code-defined interest list (src/lib/scoring/constants.ts). Null = use the code value. Applied everywhere by
  // src/lib/scoring/overrides.ts, so a change here reaches the traveller app, the scoring engine and the admin screens.
  label: text('label'),
  groupName: text('group_name'),
  hidden: boolean('hidden'),
  audienceTier: text('audience_tier'),
  /** Position in the picker; lower first. Null = the code's own order. */
  sortOrder: integer('sort_order'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Admin edits to a persona (a starting set of interest weights): its name, icon and blurb, which interests it highlights, and
 * individual weights. Only what is saved here replaces the code values in constants.ts; everything else is untouched.
 */
export const personaOverrides = pgTable('persona_overrides', {
  personaId: text('persona_id').primaryKey(),
  name: text('name'),
  icon: text('icon'),
  blurb: text('blurb'),
  primary: text('primary_keys').array(),
  /** Only the weights the admin changed, keyed by interest key (1-10). */
  weights: jsonb('weights').notNull().default({}).$type<Record<string, number>>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Admin-edited versions of the lists on an interest page's "Rules & scoring" tab (the writing rules, calibration ladder, tests and edge
 * cases). A section with no row here shows the built-in list from config.ts. This is the admin reference text only; the Gemini
 * directive files under prompts/ are separate and are not changed by these edits.
 */
export const interestRuleSections = pgTable(
  'interest_rule_sections',
  {
    interestKey: text('interest_key').notNull(),
    sectionKey: text('section_key').notNull(), // e.g. "birding.ladder"
    items: jsonb('items').notNull().$type<unknown[]>(),
    updatedBy: text('updated_by').notNull().default(''),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.interestKey, table.sectionKey] })],
);

/**
 * Admin-edited "what a 10 means" for an interest: the definition and the short list of places allowed a peak of 10. A row here
 * replaces the built-in entry in src/lib/scoring/anchors.ts for the Gemini validator and the interest pages (see
 * src/lib/scoring/anchorOverrides.ts). Null columns fall back to the built-in value.
 */
export const interestAnchorOverrides = pgTable('interest_anchor_overrides', {
  interestKey: text('interest_key').primaryKey(),
  definition: text('definition'),
  ten: text('ten').array(),
  updatedBy: text('updated_by').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---- Gemini content-generation pipeline ------------------------------------
// docs/gemini-content-pipeline-plan.md. Every call to Gemini gets a row here,
// regardless of outcome — a rejected or never-applied generation is not lost,
// it's a row with validation_status != 'applied'. This is deliberately
// separate from admin_audit_log: that table only exists once a write actually
// lands on `places`, and has no room for a prompt, a raw model response, or a
// cost. This table is the record of every ATTEMPT; admin_audit_log (via the
// normal applyAdminEdits path) remains the record of every actual CHANGE.
export const contentGenerationKindEnum = pgEnum('content_generation_kind', ['author', 'correct', 'wishlist']);
export const contentGenerationStatusEnum = pgEnum('content_generation_status', [
  'pending',
  'valid',
  'invalid',
  'applied',
  'superseded',
]);

/**
 * A named round of Gemini authoring for one interest (normally one prompt version over the catalog), made of one or more
 * batches. `finishedAt` is set deliberately (admin button or --finish-pass); while it is empty the pass is "in progress".
 * See docs/authoring-passes-spec.md.
 */
export const AUTHORING_PASS_KINDS = ['initial', 'redo', 'targeted', 'pilot'] as const;
export type AuthoringPassKind = (typeof AUTHORING_PASS_KINDS)[number];

export const authoringPasses = pgTable(
  'authoring_passes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interestKey: text('interest_key').notNull(),
    label: text('label').notNull(),
    kind: text('kind').notNull().default('redo').$type<AuthoringPassKind>(),
    promptVersion: text('prompt_version'), // e.g. "birding/v8"
    notes: text('notes').notNull().default(''),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('authoring_passes_interest_idx').on(table.interestKey, table.createdAt)],
);

export const contentGenerationBatches = pgTable('content_generation_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  interestKey: text('interest_key').notNull(),
  kind: contentGenerationKindEnum('kind').notNull(),
  rolloutPhase: smallint('rollout_phase').notNull(), // 0-3, see plan doc §8
  placeCount: integer('place_count').notNull().default(0),
  totalCostUsd: doublePrecision('total_cost_usd').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  // Added with authoring passes: which pass this batch belongs to, and what it used and cost in tokens.
  passId: uuid('pass_id').references(() => authoringPasses.id),
  promptVersion: text('prompt_version'),
  model: text('model'),
  thinkingLevel: text('thinking_level'),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0), // includes Gemini's hidden reasoning tokens (billed as output)
});

export const contentGenerations = pgTable(
  'content_generations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id').references(() => contentGenerationBatches.id),
    placeId: text('place_id').notNull(), // matches places.id — not a DB FK (places uses text ids issued by content scripts, same polymorphic-by-convention pattern as admin_audit_log above)
    interestKey: text('interest_key').notNull(),
    kind: contentGenerationKindEnum('kind').notNull(),
    // Both together let a past generation be attributed to its exact source
    // text even if the versioned prompt file is later edited in place by
    // mistake — the hash catches that; the human-readable version string
    // alone wouldn't.
    promptVersion: text('prompt_version').notNull(), // e.g. "kayakingRafting/v1"
    promptHash: text('prompt_hash').notNull(), // sha256 of the exact prompt file content used
    inputContextHash: text('input_context_hash').notNull(), // sha256 of the exact context payload sent
    model: text('model').notNull(), // e.g. "gemini-2.5-pro"
    temperature: doublePrecision('temperature').notNull(),
    rawResponse: jsonb('raw_response').notNull(), // the literal API response, untouched
    parsedOutput: jsonb('parsed_output'), // after Zod parsing, before content validation; null if schema parse itself failed
    validationStatus: contentGenerationStatusEnum('validation_status').notNull().default('pending'),
    validationErrors: jsonb('validation_errors').notNull().default([]).$type<
      Array<{ layer: 'schema' | 'content' | 'plausibility'; severity: 'reject' | 'warning'; message: string }>
    >(),
    tokensIn: integer('tokens_in').notNull(),
    tokensOut: integer('tokens_out').notNull(),
    costUsd: doublePrecision('cost_usd').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
  },
  (table) => [
    index('content_generations_place_interest_idx').on(table.placeId, table.interestKey, table.createdAt),
    index('content_generations_batch_idx').on(table.batchId),
  ],
);

// ---- Per-interest admin pages ----------------------------------------------
// One admin page per interest (src/app/admin/destinations/interests/[key]).
// Interest definitions/anchors/formulas stay in code (see SLIDERS above); these
// tables hold only what people add through that page.

/** An expert's review of an interest (or of one place within it): who, when,
 * and a note on what they did. `placeId` null means the whole interest. */
export const interestReviews = pgTable(
  'interest_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interestKey: text('interest_key').notNull(), // matches a SLIDERS[].key
    placeId: text('place_id'), // matches places.id; null = whole interest
    reviewerName: text('reviewer_name').notNull(),
    reviewerRole: text('reviewer_role'), // e.g. "Field guide author", "AI: Claude"
    reviewedOn: date('reviewed_on', { mode: 'string' }).notNull(),
    notes: text('notes').notNull().default(''),
    createdBy: text('created_by').notNull(), // admin email who typed the entry
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('interest_reviews_interest_idx').on(table.interestKey, table.reviewedOn)],
);

export const INTEREST_TODO_STATUSES = ['needs_you', 'ready_for_claude', 'waiting', 'idea', 'done'] as const;
export type InterestTodoStatus = (typeof INTEREST_TODO_STATUSES)[number];

/** Things we agreed to do but have not done yet: one list per interest, plus site-wide items under interestKey '_site'. */
export const interestTodos = pgTable(
  'interest_todos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interestKey: text('interest_key').notNull(),
    title: text('title').notNull(),
    detail: text('detail').notNull().default(''),
    status: text('status').$type<InterestTodoStatus>().notNull().default('idea'),
    source: text('source').notNull().default(''), // where it came from (a review, a chat date…)
    // A to-do about one place's text (for example "Rewrite X for its wider scope"). With closeOnApply set, applying a Gemini
    // generation for this place and interest closes it automatically (see src/lib/gemini/todo-sync.ts).
    placeId: text('place_id'),
    closeOnApply: boolean('close_on_apply').notNull().default(false),
    // 1 = high, 2 = normal, 3 = low. Sorts the to-do list; has no other effect.
    priority: integer('priority').notNull().default(2),
    // "Check on" date for the To do tab. Open items past it show as overdue. Null = no date.
    dueOn: date('due_on', { mode: 'string' }),
    // 'weekly' or 'monthly': marking the item done creates the next one on its next date. Null = one-off.
    repeatEvery: text('repeat_every').$type<'weekly' | 'monthly'>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    doneAt: timestamp('done_at', { withTimezone: true }),
  },
  (table) => [index('interest_todos_interest_idx').on(table.interestKey, table.status)],
);

export const FACT_CHECK_VERDICTS = ['unchecked', 'verified', 'wrong', 'owner_accepted'] as const;
export type FactCheckVerdict = (typeof FACT_CHECK_VERDICTS)[number];

/**
 * One row per risky sentence in generated text (a named place or route, a number with a unit, an access or closure claim,
 * "several"/"many", "only"/"first"/"longest"), keyed by place, interest and a hash of the sentence. A generation cannot be applied
 * until every high-risk sentence in it is 'verified' (checked against a source) or 'owner_accepted'. Because the key is the
 * sentence itself, an unchanged sentence keeps its verdict when text is edited and a changed sentence starts again as 'unchecked'.
 * See docs/fact-check-process.md.
 */
export const contentFactChecks = pgTable(
  'content_fact_checks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    placeId: text('place_id').notNull(),
    interestKey: text('interest_key').notNull(),
    sentenceHash: text('sentence_hash').notNull(),
    sentence: text('sentence').notNull(),
    kinds: text('kinds').array().notNull().default([]),
    verdict: text('verdict').$type<FactCheckVerdict>().notNull().default('unchecked'),
    sourceUrl: text('source_url').notNull().default(''),
    note: text('note').notNull().default(''),
    checkedBy: text('checked_by').notNull().default(''),
    checkedAt: timestamp('checked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('content_fact_checks_unique').on(table.placeId, table.interestKey, table.sentenceHash)],
);

export const INTEREST_IDEA_STAGES = ['idea', 'researched', 'verified', 'added'] as const;
export type InterestIdeaStage = (typeof INTEREST_IDEA_STAGES)[number];

/** Candidate places not in the catalog yet that would suit an interest. */
export const interestPlaceIdeas = pgTable(
  'interest_place_ideas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interestKey: text('interest_key').notNull(),
    name: text('name').notNull(),
    region: text('region').notNull().default(''),
    why: text('why').notNull().default(''),
    nearestExisting: text('nearest_existing').notNull().default(''),
    /** One of the ten place types (src/lib/admin/interest-pages/place-types.ts), or empty. */
    placeType: text('place_type').notNull().default(''),
    stage: text('stage').$type<InterestIdeaStage>().notNull().default('idea'),
    // Place grain, the same scale as the 12 Oct 2026 Place Grain Review: -2 or lower too specific, -1 slightly specific, 0 just right,
    // 1 slightly broad, 2 or higher too broad. Null = not rated. grainNote is the one-line reason.
    grain: integer('grain'),
    grainNote: text('grain_note').notNull().default(''),
    // Manual order within the list (lower first); null = after every ordered idea, then by name.
    sortOrder: integer('sort_order'),
    // Set when an idea has been turned into a real place with the Promote button.
    promotedPlaceId: text('promoted_place_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('interest_place_ideas_interest_idx').on(table.interestKey)],
);

/**
 * The handful of websites we come back to again and again to fact-check an
 * interest (a field-guide site, an official park list, a society's handbook).
 * Deliberately short: about ten per interest, not every page ever cited (the
 * per-place links live in places.sliderSources). `usefulness` is a 1-100
 * judgement (100 = best) set by a person and edited as we learn which sites
 * hold up. `lastUsedOn` and `placesChecked` say when and how widely the site
 * was last used to check this interest. Not read by scoring or the public app.
 */
export const REFERENCE_SITE_ACCESS = ['ai', 'partial', 'human'] as const;
export type ReferenceSiteAccess = (typeof REFERENCE_SITE_ACCESS)[number];

export const interestReferenceSites = pgTable(
  'interest_reference_sites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interestKey: text('interest_key').notNull(),
    /** Home page or the main page we use, e.g. https://www.10000birds.com */
    siteUrl: text('site_url').notNull(),
    label: text('label').notNull(),
    /** What it is good for, and any catch (blocked to automated reads, commercial, etc.). */
    goodFor: text('good_for').notNull().default(''),
    usefulness: integer('usefulness').notNull().default(50),
    /**
     * Who can check against it: 'ai' = Claude can read the pages directly; 'partial' = only through web
     * search results (direct reads fail or the data does not load); 'human' = blocks automated reads, a
     * person has to look it up.
     */
    aiAccess: text('ai_access').$type<ReferenceSiteAccess>().notNull().default('ai'),
    lastUsedOn: date('last_used_on', { mode: 'string' }),
    placesChecked: integer('places_checked').notNull().default(0),
    createdBy: text('created_by').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('interest_reference_sites_interest_idx').on(table.interestKey, table.usefulness),
    uniqueIndex('interest_reference_sites_unique').on(table.interestKey, table.siteUrl),
  ],
);

/** One column that feeds a chip's fit: a rating, a count, a sighting grid or a ticked option. See src/lib/admin/interest-pages/chips.ts. */
export interface InterestChipDriver {
  column: string;
  /** The option that counts, for choice and multi columns. */
  option?: string;
  /** For count columns: the number that counts as a full 10. */
  fullAt?: number;
}

export const INTEREST_CHIP_STATUSES = ['live', 'draft'] as const;
export type InterestChipStatus = (typeof INTEREST_CHIP_STATUSES)[number];

/**
 * The sub-interest chips a traveler can tick under an interest (Day hikes, Wrecks, Orcas...), kept apart from the research columns.
 * A place's fit for a chip is worked out from the driver columns when needed, never stored. At most five are live per interest.
 * needsColumn is a note: while it is filled in, the chip waits on a column that has not been added yet and cannot go live.
 */
export const interestChips = pgTable(
  'interest_chips',
  {
    interestKey: text('interest_key').notNull(),
    chipKey: text('chip_key').notNull(),
    label: text('label').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    status: text('status').$type<InterestChipStatus>().notNull().default('draft'),
    drivers: jsonb('drivers').notNull().default([]).$type<InterestChipDriver[]>(),
    needsColumn: text('needs_column').notNull().default(''),
    updatedBy: text('updated_by').notNull().default(''),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.interestKey, table.chipKey] })],
);

/** A fit typed by hand for one place and chip, with the reason. Wins over the worked-out number, and survives a re-fill of the columns. */
export const placeChipOverrides = pgTable(
  'place_chip_overrides',
  {
    interestKey: text('interest_key').notNull(),
    chipKey: text('chip_key').notNull(),
    placeId: text('place_id').notNull(),
    fit: doublePrecision('fit').notNull(),
    reason: text('reason').notNull(),
    setBy: text('set_by').notNull().default(''),
    setAt: timestamp('set_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.interestKey, table.chipKey, table.placeId] })],
);

export type InterestFactValue = string | number | boolean | string[] | null;

/**
 * Per-place, per-interest facts that sit behind the written blurbs (for
 * birding: species counts, endemics, photo ease, draw birds…). Free-form jsonb
 * keyed by fact name; src/lib/admin/interest-pages/config.ts says which keys
 * each interest uses and how they are validated. Not read by the scoring
 * engine or the public app.
 */
export const placeInterestFacts = pgTable(
  'place_interest_facts',
  {
    placeId: text('place_id').notNull(),
    interestKey: text('interest_key').notNull(),
    facts: jsonb('facts').notNull().default({}).$type<Record<string, InterestFactValue>>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.placeId, table.interestKey] })],
);
// t
