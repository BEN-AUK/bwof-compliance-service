CREATE SCHEMA "base";
--> statement-breakpoint
CREATE SCHEMA "setup";
--> statement-breakpoint
CREATE TABLE "base"."compliance_standard" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"standard_code" varchar(50) NOT NULL,
	"standard_name" text NOT NULL,
	"default_frequency" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"version" text,
	"is_deprecated" boolean DEFAULT false,
	"description" text,
	"is_default" boolean DEFAULT false,
	"ailases" text[] DEFAULT '{""}',
	CONSTRAINT "base_compliance_standard_code_version_key" UNIQUE("standard_code","version")
);
--> statement-breakpoint
ALTER TABLE "base"."compliance_standard" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "base"."frequency_dict" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"display_name" text NOT NULL,
	"interval_expression" varchar NOT NULL,
	"expected_slots_per_year" smallint NOT NULL,
	"is_standard" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "base_frequency_dict_name_key" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "base"."frequency_dict" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "base"."main_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"sort_order" smallint DEFAULT 0,
	"aliases" text[] DEFAULT '{""}',
	CONSTRAINT "base_main_category_code_key" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "base"."main_category" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "base"."organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"last_modified_by_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "base"."organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "base"."profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"role" text DEFAULT 'Staff',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"last_modified_by_id" uuid NOT NULL,
	CONSTRAINT "profiles_role_check" CHECK (role = ANY (ARRAY['Admin'::text, 'Owner'::text, 'Staff'::text]))
);
--> statement-breakpoint
ALTER TABLE "base"."profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "base"."sub_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"main_category_id" uuid NOT NULL,
	"ss_code" varchar(10) NOT NULL,
	"name" text NOT NULL,
	"default_standard_id" uuid,
	"aliases" text[] DEFAULT '{""}',
	"created_at" timestamp with time zone DEFAULT now(),
	"is_mandatory" boolean DEFAULT false,
	CONSTRAINT "base_sub_category_ss_code_key" UNIQUE("ss_code")
);
--> statement-breakpoint
ALTER TABLE "base"."sub_category" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "setup"."building_compliance_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ss_sub_category_id" uuid NOT NULL,
	"performance_standard_id" uuid,
	"raw_performance_standard_text" text,
	"inspection_standard_id" uuid,
	"raw_inspection_standard_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"last_modified_by_id" uuid NOT NULL,
	"document_id" uuid
);
--> statement-breakpoint
ALTER TABLE "setup"."building_compliance_category" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "setup"."building_compliance_category_inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compliance_category_id" uuid NOT NULL,
	"frequency_id" uuid NOT NULL,
	"inspector_role" text NOT NULL,
	"inspection_instructions" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"last_modified_by_id" uuid NOT NULL,
	CONSTRAINT "check_inspector_role" CHECK (inspector_role = ANY (ARRAY['Owner'::text, 'IQP'::text, 'Council'::text, 'Tenant'::text, 'PM'::text]))
);
--> statement-breakpoint
ALTER TABLE "setup"."building_compliance_category_inspections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "setup"."building_compliance_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"cs_number" text,
	"cs_storage_path" text,
	"form12_storage_path" text,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"last_modified_by_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "setup"."building_compliance_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "setup"."buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"council_name" text,
	"legal_description" text,
	"year_of_first_construction" text,
	"intended_life" text,
	"highest_fire_hazard_category" text,
	"risk_groups" text,
	"compliance_schedule_location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"last_modified_by_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "setup"."buildings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "setup"."owners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"email" text,
	"phone" text,
	"mailing_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"last_modified_by_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "setup"."owners" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "base"."organizations" ADD CONSTRAINT "organizations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "base"."organizations" ADD CONSTRAINT "organizations_last_modified_by_id_fkey" FOREIGN KEY ("last_modified_by_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "base"."sub_category" ADD CONSTRAINT "base_sub_category_default_standard_id_fkey" FOREIGN KEY ("default_standard_id") REFERENCES "base"."compliance_standard"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "base"."sub_category" ADD CONSTRAINT "base_sub_category_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "base"."main_category"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."building_compliance_category" ADD CONSTRAINT "bcc_document_fkey" FOREIGN KEY ("document_id") REFERENCES "setup"."building_compliance_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."building_compliance_category" ADD CONSTRAINT "bcc_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."building_compliance_category" ADD CONSTRAINT "bcc_last_modified_by_id_fkey" FOREIGN KEY ("last_modified_by_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."building_compliance_category_inspections" ADD CONSTRAINT "building_ss_inspections_parent_fkey" FOREIGN KEY ("compliance_category_id") REFERENCES "setup"."building_compliance_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."building_compliance_category_inspections" ADD CONSTRAINT "bcci_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."building_compliance_category_inspections" ADD CONSTRAINT "bcci_last_modified_by_id_fkey" FOREIGN KEY ("last_modified_by_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."building_compliance_documents" ADD CONSTRAINT "bldg_comp_docs_bldg_fkey" FOREIGN KEY ("building_id") REFERENCES "setup"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."building_compliance_documents" ADD CONSTRAINT "bldg_comp_docs_org_fkey" FOREIGN KEY ("organization_id") REFERENCES "base"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."building_compliance_documents" ADD CONSTRAINT "bldg_comp_docs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."building_compliance_documents" ADD CONSTRAINT "bldg_comp_docs_last_modified_by_id_fkey" FOREIGN KEY ("last_modified_by_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."buildings" ADD CONSTRAINT "buildings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "base"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."buildings" ADD CONSTRAINT "buildings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "setup"."owners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."buildings" ADD CONSTRAINT "buildings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."buildings" ADD CONSTRAINT "buildings_last_modified_by_id_fkey" FOREIGN KEY ("last_modified_by_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."owners" ADD CONSTRAINT "owners_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "base"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."owners" ADD CONSTRAINT "owners_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup"."owners" ADD CONSTRAINT "owners_last_modified_by_id_fkey" FOREIGN KEY ("last_modified_by_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_compliance_standard_ai_keywords" ON "base"."compliance_standard" USING gin ("ailases" array_ops);--> statement-breakpoint
CREATE INDEX "idx_inspections_parent_lookup" ON "setup"."building_compliance_category_inspections" USING btree ("compliance_category_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_unique_inspection_rule" ON "setup"."building_compliance_category_inspections" USING btree ("compliance_category_id" uuid_ops,"frequency_id" uuid_ops,"inspector_role" text_ops);--> statement-breakpoint
CREATE POLICY "Public standards read access" ON "base"."compliance_standard" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Allow read-only access for frequency_dict" ON "base"."frequency_dict" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Public dictionary read access" ON "base"."main_category" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Users can only view their own organization" ON "base"."organizations" AS PERMISSIVE FOR SELECT TO public USING ((id = ( SELECT profiles.organization_id
   FROM base.profiles
  WHERE (profiles.id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "Users can update own profile" ON "base"."profiles" AS PERMISSIVE FOR UPDATE TO public USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can view members in the same organization" ON "base"."profiles" AS PERMISSIVE FOR SELECT TO public;--> statement-breakpoint
CREATE POLICY "Public sub_category read access" ON "base"."sub_category" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "Category isolation" ON "setup"."building_compliance_category" AS PERMISSIVE FOR ALL TO public USING ((document_id IN ( SELECT building_compliance_documents.id
   FROM setup.building_compliance_documents
  WHERE (building_compliance_documents.organization_id = ( SELECT profiles.organization_id
           FROM base.profiles
          WHERE (profiles.id = auth.uid()))))));--> statement-breakpoint
CREATE POLICY "Inspections isolation" ON "setup"."building_compliance_category_inspections" AS PERMISSIVE FOR ALL TO public USING ((compliance_category_id IN ( SELECT building_compliance_category.id
   FROM setup.building_compliance_category
  WHERE (building_compliance_category.document_id IN ( SELECT building_compliance_documents.id
           FROM setup.building_compliance_documents
          WHERE (building_compliance_documents.organization_id = ( SELECT profiles.organization_id
                   FROM base.profiles
                  WHERE (profiles.id = auth.uid()))))))));--> statement-breakpoint
CREATE POLICY "Docs isolation" ON "setup"."building_compliance_documents" AS PERMISSIVE FOR ALL TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM base.profiles
  WHERE (profiles.id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "Users can manage buildings in their organization" ON "setup"."buildings" AS PERMISSIVE FOR ALL TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM base.profiles
  WHERE (profiles.id = auth.uid()))));--> statement-breakpoint
CREATE POLICY "Users can manage owners in their organization" ON "setup"."owners" AS PERMISSIVE FOR ALL TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM base.profiles
  WHERE (profiles.id = auth.uid()))));