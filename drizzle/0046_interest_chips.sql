CREATE TABLE "interest_chips" (
	"interest_key" text NOT NULL,
	"chip_key" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"drivers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"needs_column" text DEFAULT '' NOT NULL,
	"updated_by" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interest_chips_interest_key_chip_key_pk" PRIMARY KEY("interest_key","chip_key")
);
--> statement-breakpoint
CREATE TABLE "place_chip_overrides" (
	"interest_key" text NOT NULL,
	"chip_key" text NOT NULL,
	"place_id" text NOT NULL,
	"fit" double precision NOT NULL,
	"reason" text NOT NULL,
	"set_by" text DEFAULT '' NOT NULL,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_chip_overrides_interest_key_chip_key_place_id_pk" PRIMARY KEY("interest_key","chip_key","place_id")
);

--> statement-breakpoint
ALTER TABLE "interest_chips" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "place_chip_overrides" ENABLE ROW LEVEL SECURITY;
