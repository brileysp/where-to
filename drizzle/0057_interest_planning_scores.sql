ALTER TABLE "interest_meta" ADD COLUMN "seasonal_variance" smallint;--> statement-breakpoint
ALTER TABLE "interest_meta" ADD COLUMN "evergreen" smallint;--> statement-breakpoint
ALTER TABLE "interest_meta" ADD COLUMN "stakes" smallint;--> statement-breakpoint
ALTER TABLE "interest_meta" ADD COLUMN "refresh_effort" smallint;--> statement-breakpoint
ALTER TABLE "interest_meta" ADD COLUMN "planning_notes" jsonb;