CREATE TABLE "interest_stale_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"factor_id" uuid NOT NULL,
	"todo_id" uuid,
	"result" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"checked_by" text DEFAULT '' NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interest_stale_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interest_key" text NOT NULL,
	"category" text NOT NULL,
	"statement" text NOT NULL,
	"how_to_check" text DEFAULT '' NOT NULL,
	"checker" text DEFAULT 'owner' NOT NULL,
	"check_every" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interest_stale_checks" ADD CONSTRAINT "interest_stale_checks_factor_id_interest_stale_factors_id_fk" FOREIGN KEY ("factor_id") REFERENCES "public"."interest_stale_factors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interest_stale_checks_factor_idx" ON "interest_stale_checks" USING btree ("factor_id","checked_at");--> statement-breakpoint
CREATE INDEX "interest_stale_checks_todo_idx" ON "interest_stale_checks" USING btree ("todo_id");--> statement-breakpoint
CREATE INDEX "interest_stale_factors_interest_idx" ON "interest_stale_factors" USING btree ("interest_key","active");
--> statement-breakpoint
ALTER TABLE "interest_stale_factors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interest_stale_checks" ENABLE ROW LEVEL SECURITY;