CREATE TYPE "public"."crowd_baseline" AS ENUM('low', 'high');--> statement-breakpoint
ALTER TABLE "destinations" ADD COLUMN "crowd_baseline" "crowd_baseline";