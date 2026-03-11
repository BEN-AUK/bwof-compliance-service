import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import {
  CS_ANALYSIS_QUEUE,
  CS_ANALYSIS_JOB_NAME,
  type CsAnalysisJobPayload,
} from './constants';
import { TaskRepository } from '../database/repositories/task.repository';

/**
 * Enqueues analysis tasks to CS_ANALYSIS_QUEUE. Does not run analysis;
 * consumers process jobs by taskId (ID-First). jobId encodes organizationId for fairness/tracing.
 */
@Injectable()
export class QueueTaskService {
  constructor(
    @InjectQueue(CS_ANALYSIS_QUEUE)
    private readonly queue: Queue<CsAnalysisJobPayload, unknown, string>,
    private readonly taskRepository: TaskRepository,
  ) {}

  /**
   * Enqueue a single analysis job. Fails if task does not exist.
   * Payload is only { taskId }; jobId = org_${organizationId}_${taskId} for tenant traceability.
   */
  async enqueueAnalysisJob(
    taskId: string,
    organizationId: string,
  ): Promise<Job<CsAnalysisJobPayload, unknown, string>> {
    const task = await this.taskRepository.findTaskById(taskId);
    if (!task) {
      throw new NotFoundException(`Task not found: ${taskId}`);
    }
    const jobId = `org_${organizationId}_${taskId}`;
    return this.queue.add(
      CS_ANALYSIS_JOB_NAME,
      { taskId },
      { jobId },
    );
  }
}
