ALTER TABLE "content_generations" ADD COLUMN "scope_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "place_hotel_quote_runs" ADD COLUMN "scope_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "place_interest_facts" ADD COLUMN "scope_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_row_scope_version() RETURNS trigger AS $$
BEGIN
  SELECT scope_version INTO NEW.scope_version FROM place_identity WHERE key = NEW.place_id;
  IF NEW.scope_version IS NULL THEN NEW.scope_version := 1; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER place_hotel_quote_runs_scope_version BEFORE INSERT ON place_hotel_quote_runs FOR EACH ROW EXECUTE FUNCTION set_row_scope_version();
--> statement-breakpoint
CREATE TRIGGER content_generations_scope_version BEFORE INSERT ON content_generations FOR EACH ROW EXECUTE FUNCTION set_row_scope_version();
--> statement-breakpoint
CREATE TRIGGER place_interest_facts_scope_version BEFORE INSERT OR UPDATE OF facts ON place_interest_facts FOR EACH ROW EXECUTE FUNCTION set_row_scope_version();
--> statement-breakpoint
UPDATE place_interest_facts f SET scope_version = i.scope_version FROM place_identity i WHERE i.key = f.place_id AND i.scope_version > 1;
--> statement-breakpoint
UPDATE content_generations g SET scope_version = i.scope_version FROM place_identity i WHERE i.key = g.place_id AND i.scope_version > 1;
