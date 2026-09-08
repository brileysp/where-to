CREATE TYPE "public"."place_relationship_type" AS ENUM('nearby', 'day_trip', 'gateway_to', 'commonly_combined', 'alternative_to');--> statement-breakpoint
CREATE TABLE "place_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_place_id" text NOT NULL,
	"to_place_id" text NOT NULL,
	"relationship_type" "place_relationship_type" NOT NULL,
	"note" text,
	"weight" integer,
	CONSTRAINT "place_relationships_not_self" CHECK ("place_relationships"."from_place_id" <> "place_relationships"."to_place_id")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL,
	"emoji" text NOT NULL,
	"climate" "climate" NOT NULL,
	"place_type" text,
	"about" text NOT NULL,
	"overview" text,
	"cost_min" text,
	"cost_max" text,
	"cost_overview" text,
	"cost_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"base_scores" jsonb NOT NULL,
	"dry_months" smallint[] DEFAULT '{}' NOT NULL,
	"wet_months" smallint[] DEFAULT '{}' NOT NULL,
	"hot_months" smallint[] DEFAULT '{}' NOT NULL,
	"cold_months" smallint[] DEFAULT '{}' NOT NULL,
	"peak_months" smallint[] DEFAULT '{}' NOT NULL,
	"low_months" smallint[] DEFAULT '{}' NOT NULL,
	"wildlife_peak_months" smallint[] DEFAULT '{}' NOT NULL,
	"wildlife_closed_months" smallint[] DEFAULT '{}' NOT NULL,
	"birding_peak_months" smallint[] DEFAULT '{}' NOT NULL,
	"hiking_best_months" smallint[] DEFAULT '{}' NOT NULL,
	"hiking_worst_months" smallint[] DEFAULT '{}' NOT NULL,
	"inaccessible_months" smallint[] DEFAULT '{}' NOT NULL,
	"swim_hazard_months" smallint[] DEFAULT '{}' NOT NULL,
	"no_snow_months" smallint[] DEFAULT '{}' NOT NULL,
	"slider_caps" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"slider_events" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"peak_intensity" "peak_intensity",
	"crowd_baseline" "crowd_baseline",
	"hot_severity" "severity",
	"cold_severity" "severity",
	"wet_severity" "severity",
	"seasonal_hazards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"shop_closures" boolean DEFAULT false NOT NULL,
	"special_seasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"monthly_weather" text[],
	"search_aliases" text[] DEFAULT '{}' NOT NULL,
	"na_sliders" text[] DEFAULT '{}' NOT NULL,
	"budget_bands" text[] DEFAULT '{}' NOT NULL,
	"vibe_bands" text[] DEFAULT '{}' NOT NULL,
	"physical_bands" text[] DEFAULT '{}' NOT NULL,
	"activity_style_tiers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signature_tier" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"parent_place_id" text,
	"is_primary_destination" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"summary" text,
	"score_status" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score_inherited_from" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"country_code" text,
	"continent" text,
	"region_label" text,
	"latitude" double precision,
	"longitude" double precision,
	"stamp_design" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_parent_not_self" CHECK ("places"."parent_place_id" IS NULL OR "places"."parent_place_id" <> "places"."id")
);
--> statement-breakpoint
CREATE TABLE "user_hearts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"item_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_stamps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"place_id" text NOT NULL,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stamp_render" jsonb
);
--> statement-breakpoint
ALTER TABLE "place_relationships" ADD CONSTRAINT "place_relationships_from_place_id_places_id_fk" FOREIGN KEY ("from_place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_relationships" ADD CONSTRAINT "place_relationships_to_place_id_places_id_fk" FOREIGN KEY ("to_place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_parent_place_id_places_id_fk" FOREIGN KEY ("parent_place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stamps" ADD CONSTRAINT "user_stamps_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "place_relationships_unique_idx" ON "place_relationships" USING btree ("from_place_id","to_place_id","relationship_type");--> statement-breakpoint
CREATE INDEX "place_relationships_from_idx" ON "place_relationships" USING btree ("from_place_id");--> statement-breakpoint
CREATE INDEX "place_relationships_to_idx" ON "place_relationships" USING btree ("to_place_id");--> statement-breakpoint
CREATE INDEX "places_parent_place_id_idx" ON "places" USING btree ("parent_place_id");--> statement-breakpoint
CREATE INDEX "places_primary_destination_idx" ON "places" USING btree ("is_primary_destination") WHERE "places"."is_primary_destination";--> statement-breakpoint
CREATE UNIQUE INDEX "user_hearts_unique_idx" ON "user_hearts" USING btree ("user_id","item_type","item_id");--> statement-breakpoint
CREATE INDEX "user_hearts_user_id_idx" ON "user_hearts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_hearts_item_idx" ON "user_hearts" USING btree ("item_type","item_id");--> statement-breakpoint
CREATE INDEX "user_stamps_user_place_idx" ON "user_stamps" USING btree ("user_id","place_id");