import { relations } from "drizzle-orm/relations";
import {
	organizations,
	profiles,
	complianceStandard,
	subCategory,
	mainCategory,
} from "./base";
import { analysisTasks } from "./comman";
import {
	buildings,
	buildingComplianceDocuments,
	owners,
	buildingComplianceCategory,
	buildingComplianceCategoryInspections,
} from "./setup";

export const buildingComplianceDocumentsRelations = relations(
	buildingComplianceDocuments,
	({ one, many }) => ({
		building: one(buildings, {
			fields: [buildingComplianceDocuments.buildingId],
			references: [buildings.id],
		}),
		organization: one(organizations, {
			fields: [buildingComplianceDocuments.organizationId],
			references: [organizations.id],
		}),
		buildingComplianceCategories: many(buildingComplianceCategory),
	}),
);

export const buildingsRelations = relations(buildings, ({ one, many }) => ({
	analysisTasks: many(analysisTasks),
	buildingComplianceDocuments: many(buildingComplianceDocuments),
	organization: one(organizations, {
		fields: [buildings.organizationId],
		references: [organizations.id],
	}),
	owner: one(owners, {
		fields: [buildings.ownerId],
		references: [owners.id],
	}),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
	analysisTasks: many(analysisTasks),
	buildingComplianceDocuments: many(buildingComplianceDocuments),
	profiles: many(profiles),
	owners: many(owners),
	buildings: many(buildings),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
	analysisTasks: many(analysisTasks),
	organization: one(organizations, {
		fields: [profiles.organizationId],
		references: [organizations.id],
	}),
}));

export const analysisTasksRelations = relations(analysisTasks, ({ one }) => ({
	organization: one(organizations, {
		fields: [analysisTasks.organizationId],
		references: [organizations.id],
	}),
	profile: one(profiles, {
		fields: [analysisTasks.profilesId],
		references: [profiles.id],
	}),
	building: one(buildings, {
		fields: [analysisTasks.buildingId],
		references: [buildings.id],
	}),
}));

export const ownersRelations = relations(owners, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [owners.organizationId],
		references: [organizations.id],
	}),
	buildings: many(buildings),
}));

export const buildingComplianceCategoryInspectionsRelations = relations(
	buildingComplianceCategoryInspections,
	({ one }) => ({
		buildingComplianceCategory: one(buildingComplianceCategory, {
			fields: [buildingComplianceCategoryInspections.complianceCategoryId],
			references: [buildingComplianceCategory.id],
		}),
	}),
);

export const buildingComplianceCategoryRelations = relations(
	buildingComplianceCategory,
	({ one, many }) => ({
		buildingComplianceCategoryInspections: many(
			buildingComplianceCategoryInspections,
		),
		buildingComplianceDocument: one(buildingComplianceDocuments, {
			fields: [buildingComplianceCategory.documentId],
			references: [buildingComplianceDocuments.id],
		}),
	}),
);

export const subCategoryRelations = relations(subCategory, ({ one }) => ({
	complianceStandard: one(complianceStandard, {
		fields: [subCategory.defaultStandardId],
		references: [complianceStandard.id],
	}),
	mainCategory: one(mainCategory, {
		fields: [subCategory.mainCategoryId],
		references: [mainCategory.id],
	}),
}));

export const complianceStandardRelations = relations(
	complianceStandard,
	({ many }) => ({
		subCategories: many(subCategory),
	}),
);

export const mainCategoryRelations = relations(mainCategory, ({ many }) => ({
	subCategories: many(subCategory),
}));
