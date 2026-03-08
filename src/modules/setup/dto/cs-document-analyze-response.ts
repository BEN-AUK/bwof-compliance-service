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
});

export type DocumentIndex = z.infer<typeof DocumentIndexSchema>;

// =============================================================================
// AI response JSON: single source of truth — Zod schema, type inferred
// =============================================================================

/** 检查计划：用于生成证据链空格 (Compliance Slots) */
const InspectionRequirementSchema = z.object({
  frequency: z.enum([
    'Daily',
    'Weekly',
    'Monthly',
    '3 Monthly',
    '6 Monthly',
    'Annually',
  ]),
  inspector_role: z.enum(['Owner', 'IQP', 'Agent']),
});

/** 特定系统清单：核心校验数组 */
const SpecifiedSystemSchema = z.object({
  ss_code: z.string(),
  system_name: z.string(),
  compliance_baseline: z.object({
    performance_standards: z.array(z.string()),
    extent: z.string(),
  }),
  inspection_schedules: z.array(InspectionRequirementSchema),
});

/** Zod schema for AI document/image analysis JSON; used with parseJsonWithSchema. */
export const BuildingComplianceSchema = z.object({
  building_metadata: z.object({
    building_name: z.string(),
    address: z.string(),
    cs_number: z.string(),
    issue_date: z.string(),
    council_name: z.string(),
  }),
  specified_systems: z.array(SpecifiedSystemSchema),
});

/** Inferred type (single source of truth). */
export type BuildingCompliance = z.infer<typeof BuildingComplianceSchema>;

/** Returned when upload and analyze succeeds: storage path + analysis */
export type IUploadAndAnalyzeResult = {
  storagePath: string;
  analysis: BuildingCompliance;
};
