import { Logger } from '@nestjs/common';
import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { TaskService } from '../services/task.service';

/** Payload shape required by the base process flow (at least taskId). */
export interface AnalysisJobPayload {
  taskId: string;
}

/**
 * Base processor for analysis tasks: getTaskById → PROCESSING → executeAiAnalysis → updateTaskResult.
 * Subclass and implement executeAiAnalysis(); use @Processor(queueName, opts) on the subclass.
 */
export abstract class BaseAnalysisTaskProcessor<
  TPayload extends AnalysisJobPayload = AnalysisJobPayload,
> extends WorkerHost {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly taskService: TaskService) {
    super();
  }

  async process(job: Job<TPayload, unknown, string>): Promise<unknown> {
    const taskId = job.data?.taskId;
    try {
      if (!taskId || typeof taskId !== 'string') {
        throw new Error(`Missing or invalid taskId in job ${job.id}`);
      }

      const task = await this.taskService.getTaskById(taskId);
      if (!task) {
        this.logger.warn(`Task not found: ${taskId} (job ${job.id})`);
        throw new Error(`Task not found: ${taskId}`);
      }

      await this.taskService.processTask(taskId);

      const result = await this.executeAiAnalysis(task.filePath, job);

      await this.taskService.updateTaskResult(taskId, result);
      return result;
    } catch (error) {
      this.logger.error(
        `Analysis job failed: taskId=${taskId}, jobId=${job.id}, error=${String(error)}`,
        (error as Error)?.stack,
      );
      if (taskId && typeof taskId === 'string') {
        const maxAttempts = job.opts.attempts ?? 1;
        const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;
        if (isLastAttempt) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          await this.taskService.updateTaskResult(
            taskId,
            { error: errorMessage },
            { failed: true },
          );
        }
      }
      throw error;
    }
  }

  /**
   * Implement in subclass: run the actual analysis (e.g. CS document AI, or another type).
   * @param filePath - Task file path from DB
   * @param job - Full job for optional context (e.g. job.name for multi-type queues)
   */
  protected abstract executeAiAnalysis(
    filePath: string,
    job: Job<TPayload, unknown, string>,
  ): Promise<object>;
}
