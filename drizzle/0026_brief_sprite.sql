CREATE TYPE "public"."content_generation_kind" AS ENUM('author', 'correct', 'wishlist');--> statement-breakpoint
CREATE TYPE "public"."content_generation_status" AS ENUM('pending', 'valid', 'invalid', 'applied', 'superseded');--> statement-breakpoint
CREATE TABLE "content_generation_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interest_key" text NOT NULL,
	"kind" "content_generation_kind" NOT NULL,
	"rollout_phase" smallint NOT NULL,
	"place_count" integer DEFAULT 0 NOT NULL,
	"total_cost_usd" double precision DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "content_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid,
	"place_id" text NOT NULL,
	"interest_key" text NOT NULL,
	"kind" "content_generation_kind" NOT NULL,
	"prompt_version" text NOT NULL,
	"prompt_hash" text NOT NULL,
	"input_context_hash" text NOT NULL,
	"model" text NOT NULL,
	"temperature" double precision NOT NULL,
	"raw_response" jsonb NOT NULL,
	"parsed_output" jsonb,
	"validation_status" "content_generation_status" DEFAULT 'pending' NOT NULL,
	"validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tokens_in" integer NOT NULL,
	"tokens_out" integer NOT NULL,
	"cost_usd" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "content_generations" ADD CONSTRAINT "content_generations_batch_id_content_generation_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."content_generation_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_generations_place_interest_idx" ON "content_generations" USING btree ("place_id","interest_key","created_at");--> statement-breakpoint
CREATE INDEX "content_generations_batch_idx" ON "content_generations" USING btree ("batch_id");