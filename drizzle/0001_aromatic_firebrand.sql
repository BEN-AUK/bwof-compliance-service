CREATE SCHEMA "cs";
--> statement-breakpoint
CREATE TYPE "cs"."analysis_task_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TABLE "cs"."analysis_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"profiles_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"status" "cs"."analysis_task_status" DEFAULT 'PENDING' NOT NULL,
	"file_path" text NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_id" uuid NOT NULL,
	"last_modified_by_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cs"."analysis_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cs"."analysis_tasks" ADD CONSTRAINT "analysis_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "base"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cs"."analysis_tasks" ADD CONSTRAINT "analysis_tasks_profiles_id_fkey" FOREIGN KEY ("profiles_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cs"."analysis_tasks" ADD CONSTRAINT "analysis_tasks_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "setup"."buildings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cs"."analysis_tasks" ADD CONSTRAINT "analysis_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cs"."analysis_tasks" ADD CONSTRAINT "analysis_tasks_last_modified_by_id_fkey" FOREIGN KEY ("last_modified_by_id") REFERENCES "base"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analysis_tasks_org_profile_status" ON "cs"."analysis_tasks" USING btree ("organization_id" uuid_ops,"profiles_id" uuid_ops,"status");--> statement-breakpoint
CREATE POLICY "Analysis tasks isolation" ON "cs"."analysis_tasks" AS PERMISSIVE FOR ALL TO public USING ((organization_id = ( SELECT profiles.organization_id
   FROM base.profiles
  WHERE (profiles.id = auth.uid()))));