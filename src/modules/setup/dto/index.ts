/**
 * Setup 模块 DTO 统一导出。
 * 未来在此定义：建筑/文档/分类/检查等落库请求的 DTO，使用 class-validator 或 Zod 校验。
 */

export {
  BuildingComplianceSchema,
  DocumentIndexSchema,
  type BuildingCompliance,
  type DocumentIndex,
  type IUploadAndAnalyzeResult,
} from './cs-document-analyze-response';
