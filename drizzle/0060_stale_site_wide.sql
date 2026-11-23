CREATE TABLE "interest_stale_opt_outs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interest_key" text NOT NULL,
	"factor_id" uuid NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interest_stale_checks" ADD COLUMN "interest_key" text;--> statement-breakpoint
ALTER TABLE "interest_stale_opt_outs" ADD CONSTRAINT "interest_stale_opt_outs_factor_id_interest_stale_factors_id_fk" FOREIGN KEY ("factor_id") REFERENCES "public"."interest_stale_factors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "interest_stale_opt_outs_unique" ON "interest_stale_opt_outs" USING btree ("interest_key","factor_id");
--> statement-breakpoint
ALTER TABLE "interest_stale_opt_outs" ENABLE ROW LEVEL SECURITY;