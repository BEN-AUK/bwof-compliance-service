import {
	index,
	foreignKey,
	pgPolicy,
	pgSchema,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizationsInBase, profilesInBase } from "./base";
import { buildingsInSetup } from "./setup";

export const comman = pgSchema("comman");

export const analysisTaskStatusEnumInComman = comman.enum(
	"analysis_task_status",
	["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
);

export const analysisTasksInComman = comman.table(
	"analysis_tasks",
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		organizationId: uuid("organization_id").notNull(),
		profilesId: uuid("profiles_id").notNull(),
		buildingId: uuid("building_id").notNull(),
		status: analysisTaskStatusEnumInComman("status")
			.default("PENDING")
			.notNull(),
		filePath: text("file_path").notNull(),
		errorMessage: text("error_message"),
		createdAt: timestamp("created_at", {
			withTimezone: true,
			mode: "string",
		}).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", {
			withTimezone: true,
			mode: "string",
		}).defaultNow().notNull(),
		createdById: uuid("created_by_id").notNull(),
		lastModifiedById: uuid("last_modified_by_id").notNull(),
	},
	(table) => [
		index("idx_analysis_tasks_org_profile_status").using(
			"btree",
			table.organizationId.asc().nullsLast().op("uuid_ops"),
			table.profilesId.asc().nullsLast().op("uuid_ops"),
			table.status.asc().nullsLast(),
		),
		foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInBase.id],
			name: "analysis_tasks_organization_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.profilesId],
			foreignColumns: [profilesInBase.id],
			name: "analysis_tasks_profiles_id_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.buildingId],
			foreignColumns: [buildingsInSetup.id],
			name: "analysis_tasks_building_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.createdById],
			foreignColumns: [profilesInBase.id],
			name: "analysis_tasks_created_by_id_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.lastModifiedById],
			foreignColumns: [profilesInBase.id],
			name: "analysis_tasks_last_modified_by_id_fkey",
		}).onDelete("restrict"),
		pgPolicy("Analysis tasks isolation", {
			as: "permissive",
			for: "all",
			to: ["public"],
			using: sql`(organization_id = ( SELECT profiles.organization_id
   FROM base.profiles
  WHERE (profiles.id = auth.uid())))`,
		}),
	],
);
