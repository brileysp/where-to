CREATE TABLE "interest_reference_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interest_key" text NOT NULL,
	"site_url" text NOT NULL,
	"label" text NOT NULL,
	"good_for" text DEFAULT '' NOT NULL,
	"usefulness" integer DEFAULT 50 NOT NULL,
	"last_used_on" date,
	"places_checked" integer DEFAULT 0 NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "interest_reference_sites_interest_idx" ON "interest_reference_sites" USING btree ("interest_key","usefulness");--> statement-breakpoint
CREATE UNIQUE INDEX "interest_reference_sites_unique" ON "interest_reference_sites" USING btree ("interest_key","site_url");--> statement-breakpoint
ALTER TABLE "interest_reference_sites" ENABLE ROW LEVEL SECURITY;
