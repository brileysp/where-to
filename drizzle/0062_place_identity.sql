CREATE TABLE "place_id_redirects" (
	"old_id" text PRIMARY KEY NOT NULL,
	"place_key" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_id_redirects_place_key_unique" UNIQUE("place_key")
);
--> statement-breakpoint
CREATE TABLE "place_identity" (
	"key" text PRIMARY KEY NOT NULL,
	"place_id" text NOT NULL,
	"label" text NOT NULL,
	"slug" text NOT NULL,
	"level" text NOT NULL,
	"scope_version" integer DEFAULT 1 NOT NULL,
	"scope_note" text DEFAULT '' NOT NULL,
	"anchors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scope_status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_identity_place_id_unique" UNIQUE("place_id"),
	CONSTRAINT "place_identity_slug_unique" UNIQUE("slug"),
	CONSTRAINT "place_identity_key_format" CHECK ("place_identity"."key" ~ '^p[0-9]{4}$'),
	CONSTRAINT "place_identity_status" CHECK ("place_identity"."scope_status" in ('draft', 'confirmed'))
);
--> statement-breakpoint
CREATE TABLE "place_label_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"place_key" text NOT NULL,
	"label" text NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"retired_note" text DEFAULT '' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_slug_redirects" (
	"slug" text PRIMARY KEY NOT NULL,
	"place_key" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "place_source_keys" (
	"source" text NOT NULL,
	"source_key" text NOT NULL,
	"place_key" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_source_keys_source_source_key_pk" PRIMARY KEY("source","source_key")
);
--> statement-breakpoint
ALTER TABLE "place_id_redirects" ADD CONSTRAINT "place_id_redirects_place_key_place_identity_key_fk" FOREIGN KEY ("place_key") REFERENCES "public"."place_identity"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "place_identity" ADD CONSTRAINT "place_identity_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "place_label_history" ADD CONSTRAINT "place_label_history_place_key_place_identity_key_fk" FOREIGN KEY ("place_key") REFERENCES "public"."place_identity"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "place_slug_redirects" ADD CONSTRAINT "place_slug_redirects_place_key_place_identity_key_fk" FOREIGN KEY ("place_key") REFERENCES "public"."place_identity"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "place_source_keys" ADD CONSTRAINT "place_source_keys_place_key_place_identity_key_fk" FOREIGN KEY ("place_key") REFERENCES "public"."place_identity"("key") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "place_label_history_key_idx" ON "place_label_history" USING btree ("place_key");--> statement-breakpoint
CREATE UNIQUE INDEX "place_label_history_current_unique" ON "place_label_history" USING btree ("place_key") WHERE "place_label_history"."is_current";--> statement-breakpoint
CREATE INDEX "place_slug_redirects_key_idx" ON "place_slug_redirects" USING btree ("place_key");--> statement-breakpoint
CREATE INDEX "place_source_keys_key_idx" ON "place_source_keys" USING btree ("place_key");--> statement-breakpoint
ALTER TABLE "place_identity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "place_label_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "place_slug_redirects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "place_id_redirects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "place_source_keys" ENABLE ROW LEVEL SECURITY;
