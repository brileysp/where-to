CREATE TABLE "interest_anchor_overrides" (
	"interest_key" text PRIMARY KEY NOT NULL,
	"definition" text,
	"ten" text[],
	"updated_by" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
