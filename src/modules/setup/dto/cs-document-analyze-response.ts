import { z } from 'zod';

// =============================================================================
// Indexer output: page ranges (0-based for pdf-lib)
// =============================================================================

/** [start, end] inclusive 0-based page range. Uses array (not tuple) so zodToJsonSchema produces items: object, which Gemini accepts. */
const PageRangeSchema = z
  .array(z.number().int().min(0))
  .length(2)
  .describe('[start, end]');

/** Indexer output: arrays of [start, end] ranges for metadata and SS details (0-based for pdf-lib) */
export const DocumentIndexSchema = z.object({
  metadata_ranges: z
    .array(PageRangeSchema)
    .describe('Array of [start, end] ranges'),
  ss_ranges: z
    .array(PageRangeSchema)
    .describe('Array of [start, end] ranges'),
  isComplianceSchedule: z.boolean().describe('Whether the document is a compliance schedule'),
  rejection_reason: z
    .string()
    .optional()
    .describe('Reason for rejection when isComplianceSchedule is false; e.g. BWOF Document, INVALID_DOCUMENT_TYPE'),
});

export type DocumentIndex = z.infer<typeof DocumentIndexSchema>;

// =============================================================================
// AI response JSON: single source of truth — Zod schema, type inferred
// =============================================================================

/**
 * Builds the BuildingCompliance schema with dynamic frequency enum from frequency_dict names.
 * Used at startup with DB-backed values.
 */
export function buildBuildingComplianceSchema(frequencyNames: string[]) {
  const names = frequencyNames.length > 0 ? frequencyNames : ['monthly'];
  const frequencyEnum = z.enum(names as [string, ...string[]]);

  const InspectionRequirementSchema = z.object({
    frequency: frequencyEnum,
    inspector_role: z.enum(['Owner', 'IQP', 'Agent']),
  });

  const SpecifiedSystemSchema = z.object({
    ss_code: z.string(),
    system_name: z.string(),
    compliance_baseline: z.object({
      performance_standards: z.array(z.string()),
      extent: z.string(),
    }),
    inspection_schedules: z.array(InspectionRequirementSchema),
  });

  return z.object({
    building_metadata: z.object({
      building_name: z.string(),
      address: z.string(),
      cs_number: z.string(),
      issue_date: z.string(),
      council_name: z.string(),
    }),
    specified_systems: z.array(SpecifiedSystemSchema),
  });
}

/** Inferred type (single source of truth). */
export type BuildingCompliance = z.infer<
  ReturnType<typeof buildBuildingComplianceSchema>
>;

/** Returned when upload and analyze succeeds: storage path + analysis */
export type IUploadAndAnalyzeResult = {
  storagePath: string;
  analysis: BuildingCompliance;
};

// =============================================================================
// Enriched types (ID fuzzy match result; schema unchanged for AI output)
// =============================================================================

export type SubCategoryMatchInfo = {
  id: string;
  confidence_score: number;
  alternatives?: Array<{ id: string; ssCode: string; name: string }>;
};

export type EnrichedInspectionSchedule = BuildingCompliance['specified_systems'][number]['inspection_schedules'][number] & {
  frequency_dict_id?: string;
};

export type EnrichedSpecifiedSystem = BuildingCompliance['specified_systems'][number] & {
  sub_category_match?: SubCategoryMatchInfo;
  inspection_schedules: EnrichedInspectionSchedule[];
};

export type EnrichedBuildingCompliance = Omit<BuildingCompliance, 'specified_systems'> & {
  specified_systems: EnrichedSpecifiedSystem[];
};
