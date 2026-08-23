ALTER TABLE "destinations" ADD COLUMN "overview" text;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "cost_min" text;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "cost_max" text;--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "cost_items" jsonb DEFAULT '[]'::jsonb NOT NULL;