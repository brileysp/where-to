CREATE TABLE "interest_question_chips" (
	"interest_key" text NOT NULL,
	"question_key" text NOT NULL,
	"chip_key" text NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interest_question_chips_interest_key_question_key_chip_key_pk" PRIMARY KEY("interest_key","question_key","chip_key")
);
--> statement-breakpoint
ALTER TABLE "interest_question_chips" ADD CONSTRAINT "interest_question_chips_question_fk" FOREIGN KEY ("interest_key","question_key") REFERENCES "public"."interest_questions"("interest_key","question_key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "interest_question_chips" ADD CONSTRAINT "interest_question_chips_chip_fk" FOREIGN KEY ("interest_key","chip_key") REFERENCES "public"."interest_chips"("interest_key","chip_key") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "interest_question_chips_chip_idx" ON "interest_question_chips" USING btree ("interest_key","chip_key");--> statement-breakpoint
ALTER TABLE "interest_question_chips" ENABLE ROW LEVEL SECURITY;
