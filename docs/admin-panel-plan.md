# Admin Panel — Content Authoring Plan

Source of truth for the admin-authoring effort: letting an admin user
view/edit/save swipe cards, destinations, destination cost items, and
destination monthly slider scores directly, without going through a Claude
chat session or hand-editing files. This is explicitly **not** part of the
Place-hierarchy migration (see `docs/final-architecture-plan.md`, whose own
"Where the admin panel fits" section states the admin panel isn't a
migration step — it's what that migration's Phases 1–5 eventually unlock).
This document covers the parts of the admin effort that are independent of
that migration and can proceed in parallel.

---

## Decision: the database is the source of truth, not content files

Two options were considered for how admin edits actually get saved:

- **(A) Keep `content/destinations/*.json` authoritative** — admin edits
  write back to the JSON file, then re-run the same import step that
  pushes to Postgres.
- **(B) Make the database authoritative** — admin edits write straight to
  the row; the JSON files become a frozen historical snapshot, the same
  way `scripts/legacy/*.js` already is for cards/domains/dimensions/
  tensions.

**Decision: (B).** Rationale:

- It matches the pattern already in place for cards, domains, dimensions,
  and tensions today — none of those have a live re-import pipeline; the
  database is already their de facto source of truth. Choosing (B) for
  destinations removes the one inconsistency instead of adding a second,
  differently-shaped writer (a git-committing admin UI) alongside it.
- It doesn't fight deployment reality — a plain database write works
  identically in local dev and in production; a file-write-based flow
  would need a real git-provider commit API to persist anywhere that
  doesn't offer a durable, writable filesystem.
- It gives a non-technical admin an ordinary "click save, it's live"
  experience instead of exposing git mechanics (commits, merge conflicts)
  through the UI.

**What this means concretely:**

- `content/destinations/*.json` and `npm run db:import:destinations`
  become historical/legacy once destination admin-CRUD ships — the same
  status `scripts/legacy/data.js` already has. They should be explicitly
  marked as such (a header comment in the schema/import script pointing
  here is enough) rather than silently abandoned, since a future run of
  the importer would otherwise silently stomp admin edits with stale file
  content.
- `docs/content/adding-destinations.md` Part 4 ("Sync & verify workflow")
  describes today's live process and stays accurate until destination
  admin-CRUD actually ships. Once it does, that section should get the
  same retirement note Part 4 itself already gives `data.js` ("stays in
  the repo only as historical/legacy reference and is no longer the place
  to add or edit destinations").
- The `destinationSchema` zod validation in
  `scripts/content/destination-schema.ts` doesn't get thrown away — it's
  the right validation to run against a single admin-submitted record at
  save time, just invoked per-request instead of per-batch-of-files.
- Local dev (PGlite) and production (Supabase) were kept in sync
  specifically because the JSON→both-databases importer handled it. Once
  admin edits go straight to Supabase, local PGlite will drift stale
  unless something explicitly refreshes it (e.g. a "pull latest from
  Supabase into PGlite" script) — call this out as a new, small piece of
  tooling needed, not an automatically-solved problem.

---

## Scope: buildable now vs. waits for the Place migration

| Capability | Status | Why |
|---|---|---|
| Swipe cards (full CRUD) | **Shipped** | Zero coupling to the Place work — explicitly listed as untouched by that migration. No FK from cards to destinations. `/admin/cards`. |
| Domains / dimensions / tensions (CRUD) | Build now | Same "untouched" carve-out; natural to ship alongside cards since cards reference `domainKey`/`cardSubdimensions`. Not built yet. |
| Destination core fields (name, region, emoji, climate, about, overview, searchAliases, bands) | **Shipped** | Every column carries over unchanged into `places`; a later table swap should only touch the data-access functions, not the UI. `/admin/destinations/[id]`, edit-only (see next row). |
| Destination cost items (`costMin`/`costMax`/`costOverview`/`costItems[]`) | **Shipped** | Same carry-over guarantee as above. Same route as core fields. |
| Monthly slider score inputs (`baseScores`, month-fact arrays, `sliderCaps`, `sliderEvents`, `peakIntensity`, `crowdBaseline`, `shopClosures`, `specialSeasons`, `monthlyWeather`, `naSliders`, `activityStyleTiers`) | **Shipped** | The displayed "score" is derived, not stored — `deriveDestinationScores()` (`src/lib/scoring/destinations.ts`) has zero dependency on anything place-related, so the editor's live preview (calling that function directly, client-side — it's pure, no server round-trip needed) needed no rework at any migration phase. `/admin/destinations/[id]/scores`. Validated by the exact same zod building blocks `scripts/content/destination-schema.ts` uses for JSON authoring (exported from there for reuse), not a hand-copied approximation of the same rules. |
| Per-interest source record (`sliderSources` — which external page(s) verified this slider's content/score for this destination) | **Shipped** | Sparse, keyed by slider id, an ARRAY of `{url, label?, note?, addedAt}` per slider — deliberately not one source per slider, since a real research pass often draws on more than one page and a later pass can add to it without discarding the first. Deliberately NOT read by the scoring engine, same status as `travelAdvisories`. Lives on the Matrix grid (`/admin/destinations/matrix`, one row per destination×interest already), not the numeric Place Profile grid — a "Sources" column next to Events/Style tiers, same click-to-expand structured-editor pattern as the Advisories panel (`SourcesPanelCell`, `src/components/admin/cells.tsx`). |
| Creating a brand-new destination | **Wait — not just "later," structurally blocked** | `destinations.baseScores` is `NOT NULL` with no default; a "core fields only" create form would need to insert an empty/meaningless score set. Revisit once there's a real reason to add destination #201, not before. |
| `id` (slug) | **View-only, always** | Primary key; referenced by search aliases today and by `parentPlaceId`/relationships once places exist. Renaming should never be a casual UI action. |
| Related-place authoring (Explore-tab content, per-related-place scores/`summary`) | **Wait for Phase 5** | The tables don't exist until Phase 1; the actually-usable authoring path is Phase 5's more permissive schema, not Phase 1 alone. |
| Score status / inheritance UI (`scoreStatus`, `scoreInheritedFrom`) | **Wait for Phase 1** | Columns don't exist yet, and structurally can't apply to any of today's 200 destinations (none have a parent). Build the plain present/N/A version now — the five-state upgrade is additive UI later, not a rework. |
| `placeType`, `countryCode`, `continent`, `regionLabel`, `latitude`/`longitude`, `stampDesign` | **Wait for Phase 1** | New columns landing on `places`, not `destinations`. (`placeType` could optionally be pre-added to `destinations` now as migration prep, since Phase 0 is a manual editorial pass with no code dependency — an accelerant, not a requirement.) |
| Promotion/demotion controls, `place_relationships` authoring | **Wait for Phase 1 (schema) / Phase 5 (meaningful use)** | No point building UI for a flag that's always `true` or a table that's always empty. |

---

## The safety net: audit log, undo, and concurrency

Choosing the database as source of truth means an admin's mistake is
**instantly live and instantly overwrites the only copy** — there is no
git history backing it up. This section is not optional polish; it is what
makes giving up the JSON pipeline's built-in safety acceptable. Build it
**before** shipping "save" for any entity type, not after.

### 1. An append-only audit log

Add one new table, following the same polymorphic pattern already used by
`user_hearts` (`itemType`/`itemId`, validated in application code rather
than a real FK, because it points at several different tables):

```ts
export const adminAuditActionEnum = pgEnum('admin_audit_action', [
  'create',
  'update',
  'delete',
]);

export const adminAuditLog = pgTable('admin_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Plain uuid for now, matching the existing "lay the foundation, don't
  // build the login feature yet" convention userSwipes.userId already
  // uses — becomes a real FK to auth.users(id) once admin auth exists.
  actorId: uuid('actor_id').notNull(),
  // 'destination' | 'card' | 'domain' | 'dimension' | 'tension' | ... —
  // polymorphic like user_hearts.itemType; validated in application code.
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(), // the row's own primary key
  action: adminAuditActionEnum('action').notNull(),
  beforeValue: jsonb('before_value'), // full row snapshot; null on create
  afterValue: jsonb('after_value'), // full row snapshot; null on delete
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Design choices worth keeping:

- **Full-row snapshots, not diffs.** A restore is then a single read of
  one JSON blob, never a "replay every diff since" reconstruction.
- **Polymorphic `entityType`/`entityId`, not one table per entity.** Every
  admin-manageable table today (`destinations`, `cards`, `domains`,
  `dimensions`, `tensions`) has a plain `text` primary key, so `entityId`
  needs no type gymnastics across them.
- **Append-only, forever.** Nothing ever updates or deletes a row in this
  table itself — undo is implemented by *adding* a new row (see below),
  never by editing history.
- **Index on `(entityType, entityId, createdAt)`** for the obvious "show
  this record's history, most recent first" query a "History" tab needs.

### 2. Undo / restore

Undo is not a special-cased operation — it is "write an old snapshot back
through the exact same write path used for a normal edit":

1. Look up the most recent `admin_audit_log` row for that
   `(entityType, entityId)`.
2. Take its `beforeValue`.
3. Re-validate it through the same schema used for a live edit (e.g.
   `destinationSchema` for a destination) — a restore should never be able
   to write data that a fresh save wouldn't be allowed to write.
4. Perform a normal update with that snapshot as the new value.

Because step 4 goes through the same write path as any other edit, it
**also** appends a new audit row (`action: 'update'`, `beforeValue` = what
was live before the restore, `afterValue` = the restored snapshot). This
gets you "redo" for free — it's just walking the log forward again — and
means the audit table never needs a special "this row was an undo" flag.

UI implication: a "History" tab per record showing each past
`(actor, timestamp, before → after)` entry with a "Restore this version"
action next to each one.

### 3. Optimistic concurrency guard

`destinations`, `cards`, `domains`, `dimensions`, and `tensions` have no
`updatedAt` column today — add one to each table admin-CRUD will cover.
The admin UI loads a record together with its `updatedAt`; on save, the
update is conditioned on that value:

```sql
UPDATE destinations
SET ..., updated_at = now()
WHERE id = :id AND updated_at = :loadedUpdatedAt;
```

Zero rows affected means someone else saved a change since this admin
loaded the page. Surface that as "this was changed by someone else —
reload to see the latest" rather than silently overwriting it. This is the
standard optimistic-locking pattern, and it's a far friendlier failure mode
for a non-technical admin than a git merge conflict would have been.

### 4. Prefer soft delete over hard delete

Add a nullable `archivedAt` column rather than exposing a real `DELETE` in
the admin UI, mirroring the exact reasoning `docs/final-architecture-plan.md`
already lays out for `places` (publishing vs. archiving vs. hard deletion):
archiving keeps the row, its history, and every relationship intact and
just excludes it from normal queries; hard deletion should stay reserved
for genuine data-entry mistakes, gated well outside casual admin-UI reach.

### 5. One transaction per write

A row update, its `updatedAt` bump, and its audit-log insert must succeed
or fail together — a write that lands without a matching audit row is a
broken safety net, not a degraded one. Wrap all three in a single database
transaction, and route every admin write (across every entity type)
through one shared helper that does this, rather than reimplementing the
transaction/audit/concurrency logic per entity.

### Prerequisite: a real admin identity

`actorId` is meaningless without an authenticated admin user behind it.
This is a blocking dependency for the audit log specifically (not for
CRUD itself) — either wait for real Supabase Auth per the existing
"foundation, not the feature" boundary already documented in
`src/lib/db/schema.ts`, or, if admin tooling needs to ship before that,
use a single fixed interim credential/UUID as a placeholder `actorId` so
the audit log's shape doesn't need to change later.

---

## Rollout order

1. ~~Cards CRUD~~ — shipped, with the audit log + shared `withAdminAudit`
   transaction helper (`src/lib/admin/write.ts`) built and proven here
   first. Domains/dimensions/tensions CRUD reuses the identical pattern
   whenever they're actually needed — not built yet, no blocker either.
2. ~~Destinations core fields + cost items~~ — shipped
   (`/admin/destinations/[id]`), edit-only.
3. ~~Monthly slider score inputs~~ — shipped
   (`/admin/destinations/[id]/scores`). This is also the point where
   `content/destinations/*.json` / `npm run db:import:destinations` got
   their retirement note (see the file headers) — the pipeline stays live
   only for destinations never opened in the admin UI, and for authoring a
   destination's starting content before it exists in the database at all.
4. ~~History/undo UI~~ — shipped, for both cards and destinations
   (`/admin/cards/[id]/history`, `/admin/destinations/[id]/history`).
   Restore writes the selected entry's `afterValue` back through the same
   `withAdminAudit` path any other edit uses — never a special-cased
   operation, so it appends a new history entry rather than rewriting the
   past, which is what makes "redo" just walking the log forward again.
   One deliberate gap: restore does not re-validate the snapshot through
   the entity's own form schema before writing it back (those schemas are
   shaped for their form's raw input, not a full DB row, and every
   snapshot already passed validation once when it was first saved) — low
   risk for a single admin, worth hardening if a schema change and a
   restore-of-stale-data ever actually collide.
5. Still open: `updatedAt`-guard *enforcement* (the column exists on all
   three admin-writable tables; the conditional-write check doesn't yet —
   fine while there's exactly one admin), `archivedAt` soft delete (no
   delete UI exists yet for anything), and everything in the "waits for
   the Place migration" table above, once the relevant phase has landed.
