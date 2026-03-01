import { relations } from "drizzle-orm/relations";
import {
	organizationsInBase,
	profilesInBase,
	complianceStandardInBase,
	subCategoryInBase,
	mainCategoryInBase,
} from "./base";
import {
	buildingsInSetup,
	buildingComplianceDocumentsInSetup,
	ownersInSetup,
	buildingComplianceCategoryInSetup,
	buildingComplianceCategoryInspectionsInSetup,
} from "./setup";

export const buildingComplianceDocumentsInSetupRelations = relations(
	buildingComplianceDocumentsInSetup,
	({ one, many }) => ({
		buildingsInSetup: one(buildingsInSetup, {
			fields: [buildingComplianceDocumentsInSetup.buildingId],
			references: [buildingsInSetup.id],
		}),
		organizationsInBase: one(organizationsInBase, {
			fields: [buildingComplianceDocumentsInSetup.organizationId],
			references: [organizationsInBase.id],
		}),
		buildingComplianceCategoryInSetups: many(buildingComplianceCategoryInSetup),
	}),
);

export const buildingsInSetupRelations = relations(
	buildingsInSetup,
	({ one, many }) => ({
		buildingComplianceDocumentsInSetups: many(
			buildingComplianceDocumentsInSetup,
		),
		organizationsInBase: one(organizationsInBase, {
			fields: [buildingsInSetup.organizationId],
			references: [organizationsInBase.id],
		}),
		ownersInSetup: one(ownersInSetup, {
			fields: [buildingsInSetup.ownerId],
			references: [ownersInSetup.id],
		}),
	}),
);

export const organizationsInBaseRelations = relations(
	organizationsInBase,
	({ many }) => ({
		buildingComplianceDocumentsInSetups: many(
			buildingComplianceDocumentsInSetup,
		),
		profilesInBases: many(profilesInBase),
		ownersInSetups: many(ownersInSetup),
		buildingsInSetups: many(buildingsInSetup),
	}),
);

export const profilesInBaseRelations = relations(profilesInBase, ({ one }) => ({
	organizationsInBase: one(organizationsInBase, {
		fields: [profilesInBase.organizationId],
		references: [organizationsInBase.id],
	}),
}));

export const ownersInSetupRelations = relations(
	ownersInSetup,
	({ one, many }) => ({
		organizationsInBase: one(organizationsInBase, {
			fields: [ownersInSetup.organizationId],
			references: [organizationsInBase.id],
		}),
		buildingsInSetups: many(buildingsInSetup),
	}),
);

export const buildingComplianceCategoryInspectionsInSetupRelations = relations(
	buildingComplianceCategoryInspectionsInSetup,
	({ one }) => ({
		buildingComplianceCategoryInSetup: one(buildingComplianceCategoryInSetup, {
			fields: [
				buildingComplianceCategoryInspectionsInSetup.complianceCategoryId,
			],
			references: [buildingComplianceCategoryInSetup.id],
		}),
	}),
);

export const buildingComplianceCategoryInSetupRelations = relations(
	buildingComplianceCategoryInSetup,
	({ one, many }) => ({
		buildingComplianceCategoryInspectionsInSetups: many(
			buildingComplianceCategoryInspectionsInSetup,
		),
		buildingComplianceDocumentsInSetup: one(
			buildingComplianceDocumentsInSetup,
			{
				fields: [buildingComplianceCategoryInSetup.documentId],
				references: [buildingComplianceDocumentsInSetup.id],
			},
		),
	}),
);

export const subCategoryInBaseRelations = relations(subCategoryInBase, ({ one }) => ({
	complianceStandardInBase: one(complianceStandardInBase, {
		fields: [subCategoryInBase.defaultStandardId],
		references: [complianceStandardInBase.id],
	}),
	mainCategoryInBase: one(mainCategoryInBase, {
		fields: [subCategoryInBase.mainCategoryId],
		references: [mainCategoryInBase.id],
	}),
}));

export const complianceStandardInBaseRelations = relations(
	complianceStandardInBase,
	({ many }) => ({
		subCategoryInBases: many(subCategoryInBase),
	}),
);

export const mainCategoryInBaseRelations = relations(mainCategoryInBase, ({ many }) => ({
	subCategoryInBases: many(subCategoryInBase),
}));
