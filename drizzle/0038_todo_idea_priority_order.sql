ALTER TABLE "interest_place_ideas" ADD COLUMN "sort_order" integer;--> statement-breakpoint
ALTER TABLE "interest_place_ideas" ADD COLUMN "promoted_place_id" text;--> statement-breakpoint
ALTER TABLE "interest_todos" ADD COLUMN "priority" integer DEFAULT 2 NOT NULL;