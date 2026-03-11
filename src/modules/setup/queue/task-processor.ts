import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { BaseAnalysisTaskProcessor } from '../../../common/queue/base-analysis-task.processor';
import {
  CS_ANALYSIS_QUEUE,
  type CsAnalysisJobPayload,
} from '../../../common/queue/constants';
import { TaskService } from '../../../common/services/task.service';

@Processor(CS_ANALYSIS_QUEUE, { concurrency: 2 })
export class TaskProcessor extends BaseAnalysisTaskProcessor<CsAnalysisJobPayload> {
  constructor(taskService: TaskService) {
    super(taskService);
  }

  /**
   * Mock: 5s delay then return mock JSON. Next step: use BucketService/FileService
   * to resolve filePath to FileUploadInput and call CsDocumentAnalyzeService.analyze().
   */
  protected override async executeAiAnalysis(
    _filePath: string,
    _job: Job<CsAnalysisJobPayload, unknown, string>,
  ): Promise<object> {
    return new Promise((resolve) => {
      setTimeout(
        () => resolve({ summary: 'mock', score: 0 }),
        5000,
      );
    });
  }
}
