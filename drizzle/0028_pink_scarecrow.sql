CREATE TABLE "interest_place_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interest_key" text NOT NULL,
	"name" text NOT NULL,
	"region" text DEFAULT '' NOT NULL,
	"why" text DEFAULT '' NOT NULL,
	"nearest_existing" text DEFAULT '' NOT NULL,
	"stage" text DEFAULT 'idea' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interest_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interest_key" text NOT NULL,
	"place_id" text,
	"reviewer_name" text NOT NULL,
	"reviewer_role" text,
	"reviewed_on" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interest_todos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interest_key" text NOT NULL,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'idea' NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "place_interest_facts" (
	"place_id" text NOT NULL,
	"interest_key" text NOT NULL,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_interest_facts_place_id_interest_key_pk" PRIMARY KEY("place_id","interest_key")
);
--> statement-breakpoint
CREATE INDEX "interest_place_ideas_interest_idx" ON "interest_place_ideas" USING btree ("interest_key");--> statement-breakpoint
CREATE INDEX "interest_reviews_interest_idx" ON "interest_reviews" USING btree ("interest_key","reviewed_on");--> statement-breakpoint
CREATE INDEX "interest_todos_interest_idx" ON "interest_todos" USING btree ("interest_key","status");--> statement-breakpoint
-- Same posture as the other app tables (RLS on, no policies): the direct
-- database connection used by the app and scripts bypasses it, while Supabase's
-- public REST API gets no access.
ALTER TABLE "interest_place_ideas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interest_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interest_todos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "place_interest_facts" ENABLE ROW LEVEL SECURITY;
