ALTER TABLE "interest_chips" ADD COLUMN "approved_by" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "interest_chips" ADD COLUMN "approved_at" timestamp with time zone;