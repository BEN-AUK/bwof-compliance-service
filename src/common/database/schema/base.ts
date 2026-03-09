import {
	pgTable,
	pgSchema,
	foreignKey,
	pgPolicy,
	uuid,
	text,
	timestamp,
	check,
	unique,
	varchar,
	smallint,
	boolean,
	index,
	jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const base = pgSchema("base");

// --- Base domain: organizations first so profiles can reference them directly ---
export const organizations = base.table(
	"organizations",
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		name: text().notNull(),
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
		pgPolicy("Users can only view their own organization", {
			as: "permissive",
			for: "select",
			to: ["public"],
			using: sql`(id = ( SELECT profiles.organization_id
   FROM base.profiles
  WHERE (profiles.id = auth.uid())))`,
		}),
	],
);

// Profiles are keyed by auth.users.id. organization_id is enforced in SQL migrations.
export const profiles = base.table(
	"profiles",
	{
		id: uuid().primaryKey().notNull(),
		organizationId: uuid("organization_id").notNull(),
		firstName: text("first_name").notNull(),
		lastName: text("last_name"),
		role: text().default("Staff"),
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
		foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "profiles_organization_id_fkey",
		}).onDelete("restrict"),
		pgPolicy("Users can update own profile", {
			as: "permissive",
			for: "update",
			to: ["public"],
			using: sql`(id = auth.uid())`,
			withCheck: sql`(id = auth.uid())`,
		}),
		pgPolicy("Users can view members in the same organization", {
			as: "permissive",
			for: "select",
			to: ["public"],
		}),
		check(
			"profiles_role_check",
			sql`role = ANY (ARRAY['Admin'::text, 'Owner'::text, 'Staff'::text])`,
		),
	],
);

// --- Dictionary / reference tables in base ---
export const mainCategory = base.table(
	"main_category",
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		code: varchar({ length: 10 }).notNull(),
		name: text().notNull(),
		createdAt: timestamp("created_at", {
			withTimezone: true,
			mode: "string",
		}).defaultNow(),
		sortOrder: smallint("sort_order").default(0),
		aliases: text().array().default([""]),
	},
	(table) => [
		unique("base_main_category_code_key").on(table.code),
		pgPolicy("Public dictionary read access", {
			as: "permissive",
			for: "select",
			to: ["authenticated"],
			using: sql`true`,
		}),
	],
);

export const complianceStandard = base.table(
	"compliance_standard",
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		standardCode: varchar("standard_code", { length: 50 }).notNull(),
		standardName: text("standard_name").notNull(),
		defaultFrequency: jsonb("default_frequency").notNull(),
		createdAt: timestamp("created_at", {
			withTimezone: true,
			mode: "string",
		}).defaultNow(),
		version: text(),
		isDeprecated: boolean("is_deprecated").default(false),
		description: text(),
		isDefault: boolean("is_default").default(false),
		ailases: text().array().default([""]),
	},
	(table) => [
		index("idx_compliance_standard_ai_keywords").using(
			"gin",
			table.ailases.asc().nullsLast().op("array_ops"),
		),
		unique("base_compliance_standard_code_version_key").on(
			table.standardCode,
			table.version,
		),
		pgPolicy("Public standards read access", {
			as: "permissive",
			for: "select",
			to: ["authenticated"],
			using: sql`true`,
		}),
	],
);

export const frequencyDict = base.table(
	"frequency_dict",
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		name: varchar().notNull(),
		displayName: text("display_name").notNull(),
		intervalExpression: varchar("interval_expression").notNull(),
		expectedSlotsPerYear: smallint("expected_slots_per_year").notNull(),
		isStandard: boolean("is_standard").default(true),
		createdAt: timestamp("created_at", {
			withTimezone: true,
			mode: "string",
		}).defaultNow(),
	},
	(table) => [
		unique("base_frequency_dict_name_key").on(table.name),
		pgPolicy("Allow read-only access for frequency_dict", {
			as: "permissive",
			for: "select",
			to: ["anon", "authenticated"],
			using: sql`true`,
		}),
	],
);

export const subCategory = base.table(
	"sub_category",
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		mainCategoryId: uuid("main_category_id").notNull(),
		ssCode: varchar("ss_code", { length: 10 }).notNull(),
		name: text().notNull(),
		defaultStandardId: uuid("default_standard_id"),
		aliases: text().array().default([""]),
		createdAt: timestamp("created_at", {
			withTimezone: true,
			mode: "string",
		}).defaultNow(),
		isMandatory: boolean("is_mandatory").default(false),
	},
	(table) => [
		foreignKey({
			columns: [table.defaultStandardId],
			foreignColumns: [complianceStandard.id],
			name: "base_sub_category_default_standard_id_fkey",
		}).onDelete("set null"),
		foreignKey({
			columns: [table.mainCategoryId],
			foreignColumns: [mainCategory.id],
			name: "base_sub_category_main_category_id_fkey",
		}).onDelete("restrict"),
		unique("base_sub_category_ss_code_key").on(table.ssCode),
		pgPolicy("Public sub_category read access", {
			as: "permissive",
			for: "select",
			to: ["authenticated"],
			using: sql`true`,
		}),
	],
);
