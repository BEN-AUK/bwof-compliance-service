import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { unlink } from 'node:fs/promises';
import { BaseAnalysisTaskProcessor } from '../../../common/queue/base-analysis-task.processor';
import {
  CS_ANALYSIS_QUEUE,
  type CsAnalysisJobPayload,
} from '../../../common/queue/constants';
import { FileService } from '../../../common/services/file.service';
import { GoogleFileApiService } from '../../../common/services/google-file-api.service';
import { TaskService } from '../../../common/services/task.service';

@Processor(CS_ANALYSIS_QUEUE, { concurrency: 2 })
export class TaskProcessor extends BaseAnalysisTaskProcessor<CsAnalysisJobPayload> {
  constructor(
    taskService: TaskService,
    private readonly fileService: FileService,
    private readonly googleFileApi: GoogleFileApiService,
  ) {
    super(taskService);
  }

  /**
   * Resolve storage path → stream download to temp file → upload to Google File API → return upload result as task result.
   */
  protected override async executeAiAnalysis(
    filePath: string,
    _job: Job<CsAnalysisJobPayload, unknown, string>,
  ): Promise<object> {
    const { path: localPath, mimeType } =
      await this.fileService.resolveToUploadSource(filePath);
    try {
      const result = await this.googleFileApi.upload({
        filePath: localPath,
        mimeType,
      });
      return { uploadedFile: result };
    } finally {
      try {
        await unlink(localPath);
      } catch {
        // ignore cleanup failure
      }
    }
  }
}
