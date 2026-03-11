import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { type DrizzleDB, DRIZZLE } from '../database.module';
import {
  ANALYSIS_TASK_STATUS,
  analysisTasks,
} from '../schema/comman';

export interface CreatePendingTaskInput {
  organizationId: string;
  profilesId: string;
  filePath: string;
}

export interface AnalysisTaskRecord {
  id: string;
  profilesId: string;
  filePath: string;
}

@Injectable()
export class TaskRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: DrizzleDB,
  ) {}

  async createPendingTask(input: CreatePendingTaskInput): Promise<string> {
    const [task] = await this.db
      .insert(analysisTasks)
      .values({
        organizationId: input.organizationId,
        profilesId: input.profilesId,
        status: ANALYSIS_TASK_STATUS.PENDING,
        filePath: input.filePath,
        createdById: input.profilesId,
        lastModifiedById: input.profilesId,
      })
      .returning({ id: analysisTasks.id });

    return task.id;
  }

  async findTaskById(taskId: string): Promise<AnalysisTaskRecord | null> {
    const [task] = await this.db
      .select({
        id: analysisTasks.id,
        profilesId: analysisTasks.profilesId,
        filePath: analysisTasks.filePath,
      })
      .from(analysisTasks)
      .where(eq(analysisTasks.id, taskId))
      .limit(1);

    return task ?? null;
  }

  async markTaskAsProcessingIfPending(
    taskId: string,
    lastModifiedById: string,
  ): Promise<string | null> {
    const [task] = await this.db
      .update(analysisTasks)
      .set({
        status: ANALYSIS_TASK_STATUS.PROCESSING,
        lastModifiedById,
      })
      .where(
        and(
          eq(analysisTasks.id, taskId),
          eq(analysisTasks.status, ANALYSIS_TASK_STATUS.PENDING),
        ),
      )
      .returning({ id: analysisTasks.id });

    return task?.id ?? null;
  }


  /**
   * Completes a task that is currently PROCESSING with a result (idempotent).
   * Returns the task id if updated, null if task not found or not in PROCESSING.
   */
  async completeTaskSuccessWithResult(
    taskId: string,
    result: object,
  ): Promise<string | null> {
    const [task] = await this.db
      .update(analysisTasks)
      .set({
        status: ANALYSIS_TASK_STATUS.COMPLETED,
        result: result as Record<string, unknown>,
        lastModifiedById: sql`${analysisTasks.profilesId}`,
      })
      .where(
        and(
          eq(analysisTasks.id, taskId),
          eq(analysisTasks.status, ANALYSIS_TASK_STATUS.PROCESSING),
        ),
      )
      .returning({ id: analysisTasks.id });

    return task?.id ?? null;
  }
}
