CREATE TYPE "public"."card_stage" AS ENUM('broad', 'deep');--> statement-breakpoint
CREATE TYPE "public"."climate" AS ENUM('tropical', 'desert', 'mediterranean', 'temperate', 'highland', 'polar');--> statement-breakpoint
CREATE TYPE "public"."peak_intensity" AS ENUM('mild', 'moderate', 'extreme');--> statement-breakpoint
CREATE TYPE "public"."swipe_type" AS ENUM('no', 'yes', 'love');--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY NOT NULL,
	"short" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"image_prompt" text,
	"preference_signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dimension_signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stage" "card_stage" DEFAULT 'broad' NOT NULL,
	"domain_key" text,
	"card_subdimensions" text[],
	"sample_destinations" text[],
	"unlock_min_positive" integer,
	"unlock_min_love" integer,
	"diagnostic_purpose" text
);
--> statement-breakpoint
CREATE TABLE "destinations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL,
	"emoji" text NOT NULL,
	"climate" "climate" NOT NULL,
	"about" text NOT NULL,
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
	"peak_intensity" "peak_intensity",
	"shop_closures" boolean DEFAULT false NOT NULL,
	"special_seasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"monthly_weather" text[],
	"search_aliases" text[] DEFAULT '{}' NOT NULL,
	"na_sliders" text[] DEFAULT '{}' NOT NULL,
	"budget_bands" text[] DEFAULT '{}' NOT NULL,
	"vibe_bands" text[] DEFAULT '{}' NOT NULL,
	"physical_bands" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dimensions" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"pole_a" text NOT NULL,
	"pole_b" text NOT NULL,
	"key_a" text NOT NULL,
	"key_b" text NOT NULL,
	"summary_a" text NOT NULL,
	"summary_b" text NOT NULL,
	"question" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"emoji" text NOT NULL,
	"has_deep_cards" boolean DEFAULT false NOT NULL,
	"match_categories" text[] DEFAULT '{}' NOT NULL,
	"match_tags" text[] DEFAULT '{}' NOT NULL,
	"unlock_min_positive" integer,
	"unlock_min_love" integer,
	"transition_title" text,
	"transition_body" text
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subdimensions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_key" text NOT NULL,
	"name" text NOT NULL,
	"ordinal" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tensions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"insight_text" text NOT NULL,
	"recommendation_implication" text,
	"related_dimension_ids" text[] DEFAULT '{}' NOT NULL,
	"signal_a" jsonb NOT NULL,
	"signal_b" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travel_dna_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"profile" jsonb NOT NULL,
	"dimension_state" jsonb NOT NULL,
	"confirmed_insights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_dna_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"version" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_saved_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"weights" jsonb NOT NULL,
	"bands" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_swipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" text NOT NULL,
	"swipe_type" "swipe_type" NOT NULL,
	"session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_domain_key_domains_key_fk" FOREIGN KEY ("domain_key") REFERENCES "public"."domains"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subdimensions" ADD CONSTRAINT "subdimensions_domain_key_domains_key_fk" FOREIGN KEY ("domain_key") REFERENCES "public"."domains"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_swipes" ADD CONSTRAINT "user_swipes_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;