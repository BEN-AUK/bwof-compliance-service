import { Injectable } from '@nestjs/common';
import { type FileUploadInput } from '../../../common/services/file.service';
import {
  FileUploadAiService,
  type IUploadAndAnalyzeResult,
} from './file-upload-ai.service';

/**
 * SetupService - 承载 buildings / documents / category / inspections 的联合落库事务。
 * 未来在此实现：单次事务内写入多表，并注入 created_by_id / last_modified_by_id。
 * 禁止物理删除，使用状态机 + archived_at 软删除。
 * 文件上传与 AI 解析委托给 FileUploadAiService。
 */
@Injectable()
export class SetupService {
  constructor(private readonly fileUploadAi: FileUploadAiService) {}

  /**
   * 上传文件至 Supabase 私有 Bucket 并通过 Gemini 解析（Prompt 按 promptId 从 config/prompts.yaml 读取），返回存储路径与分析结果。
   * 失败时自动清理已上传文件。
   */
  uploadAndAnalyzeFile(
    file: FileUploadInput,
    options?: { pathPrefix?: string; promptId?: string },
  ): Promise<IUploadAndAnalyzeResult> {
    return this.fileUploadAi.uploadAndAnalyze(file, options);
  }
}
