ALTER TABLE "destinations" ADD COLUMN "slider_curves" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "slider_curves" jsonb DEFAULT '{}'::jsonb NOT NULL;