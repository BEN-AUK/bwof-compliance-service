import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ProfileRepository,
  TaskRepository,
} from '../database/repositories';
import { ANALYSIS_TASK_STATUS } from '../database/schema/common';
import { AuthContext } from './auth-context.service';

@Injectable()
export class TaskService {
  constructor(
    private readonly authContext: AuthContext,
    private readonly profileRepository: ProfileRepository,
    private readonly taskRepository: TaskRepository,
  ) {}

  async createTask(filePath: string): Promise<string> {
    const profileId = this.authContext.getProfileId();
    const organizationId =
      await this.profileRepository.findOrganizationIdByProfileId(profileId);

    if (!organizationId) {
      throw new NotFoundException(`Profile not found: ${profileId}`);
    }

    return this.taskRepository.createPendingTask({
      organizationId,
      profilesId: profileId,
      filePath,
    });
  }

  /**
   * Returns task by id with filePath (for queue processors). Returns null if not found.
   */
  async getTaskById(
    taskId: string,
  ): Promise<{ filePath: string; profilesId: string } | null> {
    const task = await this.taskRepository.findTaskById(taskId);
    if (!task) return null;
    return { filePath: task.filePath, profilesId: task.profilesId };
  }

  async processTask(taskId: string): Promise<void> {
    const task = await this.taskRepository.findTaskById(taskId);

    if (!task) {
      throw new NotFoundException(`Task not found: ${taskId}`);
    }

    const updatedTaskId = await this.taskRepository.markTaskAsProcessingIfPending(
      taskId,
      task.profilesId,
    );

    if (!updatedTaskId) {
      throw new ConflictException(
        `Task ${taskId} is no longer in ${ANALYSIS_TASK_STATUS.PENDING} status`,
      );
    }
  }

  /**
   * Completes a task with analysis result. Idempotent: only updates when status is PROCESSING.
   */
  async updateTaskResult(taskId: string, result: object): Promise<void> {
    try {
      if (typeof taskId !== 'string' || result == null) return;
      await this.taskRepository.completeTaskSuccessWithResult(taskId, result);
    } catch {
      // Defensive: avoid throwing so callers (e.g. queue workers) can continue
    }
  }

}
