CREATE TABLE "persona_overrides" (
	"persona_id" text PRIMARY KEY NOT NULL,
	"name" text,
	"icon" text,
	"blurb" text,
	"primary_keys" text[],
	"weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interest_meta" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "interest_meta" ADD COLUMN "group_name" text;--> statement-breakpoint
ALTER TABLE "interest_meta" ADD COLUMN "hidden" boolean;--> statement-breakpoint
ALTER TABLE "interest_meta" ADD COLUMN "audience_tier" text;--> statement-breakpoint
ALTER TABLE "interest_meta" ADD COLUMN "sort_order" integer;