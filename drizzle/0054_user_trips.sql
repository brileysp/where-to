CREATE TABLE "user_trips" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_auto" boolean DEFAULT true NOT NULL,
	"month" integer,
	"week" integer DEFAULT 0 NOT NULL,
	"year" integer,
	"year_auto" boolean DEFAULT true NOT NULL,
	"length" text,
	"continents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "user_trips_user_idx" ON "user_trips" USING btree ("user_id","updated_at");
--> statement-breakpoint
ALTER TABLE "user_trips" ENABLE ROW LEVEL SECURITY;
