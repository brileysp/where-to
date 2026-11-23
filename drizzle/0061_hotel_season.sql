CREATE TABLE "place_hotel_quote_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_id" text NOT NULL,
	"kind" text DEFAULT 'luxury' NOT NULL,
	"source" text DEFAULT 'booking.com' NOT NULL,
	"search_term" text NOT NULL,
	"method" text DEFAULT '' NOT NULL,
	"quoted_on" date NOT NULL,
	"dates" jsonb NOT NULL,
	"listed" jsonb NOT NULL,
	"panel" jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_hotel_season" (
	"place_id" text NOT NULL,
	"kind" text DEFAULT 'luxury' NOT NULL,
	"run_id" uuid NOT NULL,
	"summary" jsonb NOT NULL,
	"as_of" date NOT NULL,
	"flags" text[] DEFAULT '{}' NOT NULL,
	"swing" double precision,
	"overrides" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_hotel_season_place_id_kind_pk" PRIMARY KEY("place_id","kind")
);
--> statement-breakpoint
ALTER TABLE "place_hotel_quote_runs" ADD CONSTRAINT "place_hotel_quote_runs_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_hotel_season" ADD CONSTRAINT "place_hotel_season_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_hotel_season" ADD CONSTRAINT "place_hotel_season_run_id_place_hotel_quote_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."place_hotel_quote_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_hotel_quote_runs_place_idx" ON "place_hotel_quote_runs" USING btree ("place_id","kind","quoted_on");--> statement-breakpoint
CREATE UNIQUE INDEX "place_hotel_quote_runs_current_unique" ON "place_hotel_quote_runs" USING btree ("place_id","kind") WHERE "place_hotel_quote_runs"."is_current";
--> statement-breakpoint
ALTER TABLE "place_hotel_quote_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "place_hotel_season" ENABLE ROW LEVEL SECURITY;