CREATE TABLE "interest_questions" (
	"interest_key" text NOT NULL,
	"question_key" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"text" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_picks" integer DEFAULT 1 NOT NULL,
	"kind" text DEFAULT 'lean' NOT NULL,
	"columns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"approved_by" text DEFAULT '' NOT NULL,
	"approved_at" timestamp with time zone,
	"updated_by" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interest_questions_interest_key_question_key_pk" PRIMARY KEY("interest_key","question_key")
);

--> statement-breakpoint
ALTER TABLE "interest_questions" ENABLE ROW LEVEL SECURITY;
