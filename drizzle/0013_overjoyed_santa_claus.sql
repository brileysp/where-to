CREATE TYPE "public"."severity" AS ENUM('mild', 'moderate', 'severe');--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "hot_severity" "severity";--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "cold_severity" "severity";--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "wet_severity" "severity";--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "seasonal_hazards" jsonb DEFAULT '[]'::jsonb NOT NULL;