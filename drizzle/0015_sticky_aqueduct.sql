CREATE TABLE "interest_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"emoji" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "score_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL;