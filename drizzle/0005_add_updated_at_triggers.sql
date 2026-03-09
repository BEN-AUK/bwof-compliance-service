CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "set_updated_at_on_base_organizations" ON "base"."organizations";
--> statement-breakpoint
CREATE TRIGGER "set_updated_at_on_base_organizations"
BEFORE UPDATE ON "base"."organizations"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "set_updated_at_on_base_profiles" ON "base"."profiles";
--> statement-breakpoint
CREATE TRIGGER "set_updated_at_on_base_profiles"
BEFORE UPDATE ON "base"."profiles"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "set_updated_at_on_setup_owners" ON "setup"."owners";
--> statement-breakpoint
CREATE TRIGGER "set_updated_at_on_setup_owners"
BEFORE UPDATE ON "setup"."owners"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "set_updated_at_on_setup_buildings" ON "setup"."buildings";
--> statement-breakpoint
CREATE TRIGGER "set_updated_at_on_setup_buildings"
BEFORE UPDATE ON "setup"."buildings"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "set_updated_at_on_setup_building_compliance_documents" ON "setup"."building_compliance_documents";
--> statement-breakpoint
CREATE TRIGGER "set_updated_at_on_setup_building_compliance_documents"
BEFORE UPDATE ON "setup"."building_compliance_documents"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "set_updated_at_on_setup_building_compliance_category" ON "setup"."building_compliance_category";
--> statement-breakpoint
CREATE TRIGGER "set_updated_at_on_setup_building_compliance_category"
BEFORE UPDATE ON "setup"."building_compliance_category"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "set_updated_at_on_setup_building_compliance_category_inspections" ON "setup"."building_compliance_category_inspections";
--> statement-breakpoint
CREATE TRIGGER "set_updated_at_on_setup_building_compliance_category_inspections"
BEFORE UPDATE ON "setup"."building_compliance_category_inspections"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "set_updated_at_on_comman_analysis_tasks" ON "comman"."analysis_tasks";
--> statement-breakpoint
CREATE TRIGGER "set_updated_at_on_comman_analysis_tasks"
BEFORE UPDATE ON "comman"."analysis_tasks"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_updated_at"();
