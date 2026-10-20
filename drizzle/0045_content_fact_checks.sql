CREATE TABLE "content_fact_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" text NOT NULL,
	"interest_key" text NOT NULL,
	"sentence_hash" text NOT NULL,
	"sentence" text NOT NULL,
	"kinds" text[] DEFAULT '{}' NOT NULL,
	"verdict" text DEFAULT 'unchecked' NOT NULL,
	"source_url" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"checked_by" text DEFAULT '' NOT NULL,
	"checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "content_fact_checks_unique" ON "content_fact_checks" USING btree ("place_id","interest_key","sentence_hash");
--> statement-breakpoint
ALTER TABLE "content_fact_checks" ENABLE ROW LEVEL SECURITY;
