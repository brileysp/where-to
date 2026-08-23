CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"persona_id" text,
	"weights" jsonb NOT NULL,
	"bands" jsonb NOT NULL,
	"month" integer,
	"month_chosen" boolean DEFAULT false NOT NULL,
	"show_all_sliders" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
