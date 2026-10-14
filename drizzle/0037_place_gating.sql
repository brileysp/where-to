ALTER TABLE "places" ADD COLUMN "gated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "gated_interests" text[] DEFAULT '{}' NOT NULL;