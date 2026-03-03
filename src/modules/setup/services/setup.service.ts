import { Injectable } from '@nestjs/common';
import { type FileUploadInput } from '../../../common/services/file.service';
import {
  FileUploadAiService,
  type IFileAnalyzeResult,
} from './file-upload-ai.service';

/**
 * SetupService - 承载 buildings / documents / category / inspections 的联合落库事务。
 * 未来在此实现：单次事务内写入多表，并注入 created_by_id / last_modified_by_id。
 * 禁止物理删除，使用状态机 + archived_at 软删除。
 * 文件上传与 AI 解析委托给 FileUploadAiService；上传和分析分开执行，由调用方按需调用。
 */
@Injectable()
export class SetupService {
  constructor(private readonly fileUploadAi: FileUploadAiService) {}

  /** 上传文件至 Supabase 私有 Bucket，返回存储路径。 */
  uploadFile(
    file: FileUploadInput,
    options?: { pathPrefix?: string },
  ): Promise<{ storagePath: string }> {
    return this.fileUploadAi.upload(file, options);
  }

  /** 对文件做 AI 解析（Gemini，Prompt 按 promptId 从 config/prompts.yaml 读取）。不上传，仅分析。 */
  analyzeFile(
    file: FileUploadInput,
    options?: { promptId?: string },
  ): Promise<IFileAnalyzeResult> {
    return this.fileUploadAi.analyze(file, options);
  }
}
