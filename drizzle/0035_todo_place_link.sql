ALTER TABLE "interest_todos" ADD COLUMN "place_id" text;--> statement-breakpoint
ALTER TABLE "interest_todos" ADD COLUMN "close_on_apply" boolean DEFAULT false NOT NULL;