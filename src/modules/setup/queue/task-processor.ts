import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { BaseAnalysisTaskProcessor } from '../../../common/queue/base-analysis-task.processor';
import {
  CS_ANALYSIS_QUEUE,
  type CsAnalysisJobPayload,
} from '../../../common/queue/constants';
import { FileService } from '../../../common/services/file.service';
import { TaskService } from '../../../common/services/task.service';
import { CsDocumentAnalyzeService } from '../services/cs-document-analyze.service';

@Processor(CS_ANALYSIS_QUEUE, { concurrency: 2 })
export class TaskProcessor extends BaseAnalysisTaskProcessor<CsAnalysisJobPayload> {
  constructor(
    taskService: TaskService,
    private readonly fileService: FileService,
    private readonly csDocumentAnalyzeService: CsDocumentAnalyzeService,
  ) {
    super(taskService);
  }

  /**
   * Resolve storage path → download to buffer → run CS document analyze (Gemini); return BuildingCompliance as task result.
   */
  protected override async executeAiAnalysis(
    filePath: string,
    _job: Job<CsAnalysisJobPayload, unknown, string>,
  ): Promise<object> {
    const { buffer, mimeType } =
      await this.fileService.resolveToBuffer(filePath);
    return this.csDocumentAnalyzeService.analyze({ buffer, mimetype: mimeType });
  }
}
