CREATE TABLE "interest_rule_sections" (
	"interest_key" text NOT NULL,
	"section_key" text NOT NULL,
	"items" jsonb NOT NULL,
	"updated_by" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interest_rule_sections_interest_key_section_key_pk" PRIMARY KEY("interest_key","section_key")
);
