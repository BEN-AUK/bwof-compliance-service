import {
	index,
	foreignKey,
	jsonb,
	pgPolicy,
	pgSchema,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations, profiles } from "./base";

export const common = pgSchema("common");

export const ANALYSIS_TASK_STATUS = {
	PENDING: "PENDING",
	PROCESSING: "PROCESSING",
	COMPLETED: "COMPLETED",
	FAILED: "FAILED",
} as const;

export type AnalysisTaskStatus =
	(typeof ANALYSIS_TASK_STATUS)[keyof typeof ANALYSIS_TASK_STATUS];

export const analysisTaskStatusEnum = common.enum(
	"analysis_task_status",
	Object.values(ANALYSIS_TASK_STATUS) as [
		AnalysisTaskStatus,
		...AnalysisTaskStatus[],
	],
);

export const analysisTasks = common.table(
	"analysis_tasks",
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		organizationId: uuid("organization_id").notNull(),
		profilesId: uuid("profiles_id").notNull(),
		status: analysisTaskStatusEnum("status")
			.default(ANALYSIS_TASK_STATUS.PENDING)
			.notNull(),
		filePath: text("file_path").notNull(),
		errorMessage: text("error_message"),
		result: jsonb("result"),
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
			foreignColumns: [organizations.id],
			name: "analysis_tasks_organization_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.profilesId],
			foreignColumns: [profiles.id],
			name: "analysis_tasks_profiles_id_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.createdById],
			foreignColumns: [profiles.id],
			name: "analysis_tasks_created_by_id_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.lastModifiedById],
			foreignColumns: [profiles.id],
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
