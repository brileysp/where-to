CREATE TABLE "authoring_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interest_key" text NOT NULL,
	"label" text NOT NULL,
	"kind" text DEFAULT 'redo' NOT NULL,
	"prompt_version" text,
	"notes" text DEFAULT '' NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_generation_batches" ADD COLUMN "pass_id" uuid;--> statement-breakpoint
ALTER TABLE "content_generation_batches" ADD COLUMN "prompt_version" text;--> statement-breakpoint
ALTER TABLE "content_generation_batches" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "content_generation_batches" ADD COLUMN "thinking_level" text;--> statement-breakpoint
ALTER TABLE "content_generation_batches" ADD COLUMN "tokens_in" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "content_generation_batches" ADD COLUMN "tokens_out" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "authoring_passes_interest_idx" ON "authoring_passes" USING btree ("interest_key","created_at");--> statement-breakpoint
ALTER TABLE "content_generation_batches" ADD CONSTRAINT "content_generation_batches_pass_id_authoring_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."authoring_passes"("id") ON DELETE no action ON UPDATE no action;