-- Supabase security advisory (rls_disabled_in_public, 11 Oct 2026): these six tables had Row-Level Security off, so anyone holding the
-- project URL and the public key could read, edit and delete them through Supabase's own web API.
-- With RLS on and no policies, that outside access is blocked. The app is not affected: it reaches the database through DATABASE_URL as the
-- owner role (postgres), which ignores RLS, and uses the Supabase client only for sign-in.
ALTER TABLE "authoring_passes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content_generation_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "content_generations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interest_anchor_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interest_rule_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "persona_overrides" ENABLE ROW LEVEL SECURITY;
