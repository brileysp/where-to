ALTER TABLE "destinations" ADD COLUMN "activity_style_tiers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "earned_styles" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "selected_styles" jsonb DEFAULT '{}'::jsonb NOT NULL;