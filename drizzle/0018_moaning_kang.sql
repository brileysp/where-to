ALTER TABLE "destinations" ADD COLUMN "audience_bands" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "audience_bands" text[] DEFAULT '{}' NOT NULL;