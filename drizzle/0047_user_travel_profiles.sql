CREATE TABLE "user_travel_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"profile" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
ALTER TABLE "user_travel_profiles" ENABLE ROW LEVEL SECURITY;
