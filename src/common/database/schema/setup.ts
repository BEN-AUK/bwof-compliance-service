import {
	pgSchema,
	foreignKey,
	pgPolicy,
	uuid,
	text,
	boolean,
	timestamp,
	check,
	index,
	uniqueIndex,
	jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizationsInBase, profilesInBase } from "./base";

export const setup = pgSchema("setup");

export const ownersInSetup = setup.table(
	"owners",
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		organizationId: uuid("organization_id").notNull(),
		name: text().notNull(),
		contactPerson: text("contact_person"),
		email: text(),
		phone: text(),
		mailingAddress: text("mailing_address"),
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
			foreignColumns: [organizationsInBase.id],
			name: "owners_organization_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.createdById],
			foreignColumns: [profilesInBase.id],
			name: "owners_created_by_id_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.lastModifiedById],
			foreignColumns: [profilesInBase.id],
			name: "owners_last_modified_by_id_fkey",
		}).onDelete("restrict"),
		pgPolicy("Users can manage owners in their organization", {
			as: "permissive",
			for: "all",
			to: ["public"],
			using: sql`(organization_id = ( SELECT profiles.organization_id
   FROM base.profiles
  WHERE (profiles.id = auth.uid())))`,
		}),
	],
);

export const buildingsInSetup = setup.table(
	"buildings",
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		organizationId: uuid("organization_id").notNull(),
		ownerId: uuid("owner_id"),
		name: text().notNull(),
		address: text().notNull(),
		councilName: text("council_name"),
		legalDescription: text("legal_description"),
		yearOfFirstConstruction: text("year_of_first_construction"),
		intendedLife: text("intended_life"),
		highestFireHazardCategory: text("highest_fire_hazard_category"),
		riskGroups: text("risk_groups"),
		complianceScheduleLocation: text("compliance_schedule_location"),
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
			foreignColumns: [organizationsInBase.id],
			name: "buildings_organization_id_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.ownerId],
			foreignColumns: [ownersInSetup.id],
			name: "buildings_owner_id_fkey",
		}).onDelete("set null"),
		foreignKey({
			columns: [table.createdById],
			foreignColumns: [profilesInBase.id],
			name: "buildings_created_by_id_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.lastModifiedById],
			foreignColumns: [profilesInBase.id],
			name: "buildings_last_modified_by_id_fkey",
		}).onDelete("restrict"),
		pgPolicy("Users can manage buildings in their organization", {
			as: "permissive",
			for: "all",
			to: ["public"],
			using: sql`(organization_id = ( SELECT profiles.organization_id
   FROM base.profiles
  WHERE (profiles.id = auth.uid())))`,
		}),
	],
);

export const buildingComplianceDocumentsInSetup = setup.table(
	"building_compliance_documents",
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		organizationId: uuid("organization_id").notNull(),
		buildingId: uuid("building_id").notNull(),
		csNumber: text("cs_number"),
		csStoragePath: text("cs_storage_path"),
		form12StoragePath: text("form12_storage_path"),
		isArchived: boolean("is_archived").default(false),
		archivedAt: timestamp("archived_at", {
			withTimezone: true,
			mode: "string",
		}),
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
			columns: [table.buildingId],
			foreignColumns: [buildingsInSetup.id],
			name: "bldg_comp_docs_bldg_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizationsInBase.id],
			name: "bldg_comp_docs_org_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.createdById],
			foreignColumns: [profilesInBase.id],
			name: "bldg_comp_docs_created_by_id_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.lastModifiedById],
			foreignColumns: [profilesInBase.id],
			name: "bldg_comp_docs_last_modified_by_id_fkey",
		}).onDelete("restrict"),
		pgPolicy("Docs isolation", {
			as: "permissive",
			for: "all",
			to: ["public"],
			using: sql`(organization_id = ( SELECT profiles.organization_id
   FROM base.profiles
  WHERE (profiles.id = auth.uid())))`,
		}),
	],
);

export const buildingComplianceCategoryInSetup = setup.table(
	"building_compliance_category",
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		ssSubCategoryId: uuid("ss_sub_category_id").notNull(),
		performanceStandardId: uuid("performance_standard_id"),
		rawPerformanceStandardText: text("raw_performance_standard_text"),
		inspectionStandardId: uuid("inspection_standard_id"),
		rawInspectionStandardText: text("raw_inspection_standard_text"),
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
		documentId: uuid("document_id"),
	},
	(table) => [
		foreignKey({
			columns: [table.documentId],
			foreignColumns: [buildingComplianceDocumentsInSetup.id],
			name: "bcc_document_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.createdById],
			foreignColumns: [profilesInBase.id],
			name: "bcc_created_by_id_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.lastModifiedById],
			foreignColumns: [profilesInBase.id],
			name: "bcc_last_modified_by_id_fkey",
		}).onDelete("restrict"),
		pgPolicy("Category isolation", {
			as: "permissive",
			for: "all",
			to: ["public"],
			using: sql`(document_id IN ( SELECT building_compliance_documents.id
   FROM setup.building_compliance_documents
  WHERE (building_compliance_documents.organization_id = ( SELECT profiles.organization_id
           FROM base.profiles
          WHERE (profiles.id = auth.uid())))))`,
		}),
	],
);

export const buildingComplianceCategoryInspectionsInSetup = setup.table(
	"building_compliance_category_inspections",
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		complianceCategoryId: uuid("compliance_category_id").notNull(),
		frequencyId: uuid("frequency_id").notNull(),
		inspectorRole: text("inspector_role").notNull(),
		inspectionInstructions: jsonb("inspection_instructions").default([]),
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
		index("idx_inspections_parent_lookup").using(
			"btree",
			table.complianceCategoryId.asc().nullsLast().op("uuid_ops"),
		),
		uniqueIndex("idx_unique_inspection_rule").using(
			"btree",
			table.complianceCategoryId.asc().nullsLast().op("uuid_ops"),
			table.frequencyId.asc().nullsLast().op("uuid_ops"),
			table.inspectorRole.asc().nullsLast().op("text_ops"),
		),
		foreignKey({
			columns: [table.complianceCategoryId],
			foreignColumns: [buildingComplianceCategoryInSetup.id],
			name: "building_ss_inspections_parent_fkey",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.createdById],
			foreignColumns: [profilesInBase.id],
			name: "bcci_created_by_id_fkey",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.lastModifiedById],
			foreignColumns: [profilesInBase.id],
			name: "bcci_last_modified_by_id_fkey",
		}).onDelete("restrict"),
		pgPolicy("Inspections isolation", {
			as: "permissive",
			for: "all",
			to: ["public"],
			using: sql`(compliance_category_id IN ( SELECT building_compliance_category.id
   FROM setup.building_compliance_category
  WHERE (building_compliance_category.document_id IN ( SELECT building_compliance_documents.id
           FROM setup.building_compliance_documents
          WHERE (building_compliance_documents.organization_id = ( SELECT profiles.organization_id
                   FROM base.profiles
                  WHERE (profiles.id = auth.uid())))))))`,
		}),
		check(
			"check_inspector_role",
			sql`inspector_role = ANY (ARRAY['Owner'::text, 'IQP'::text, 'Council'::text, 'Tenant'::text, 'PM'::text])`,
		),
	],
);
