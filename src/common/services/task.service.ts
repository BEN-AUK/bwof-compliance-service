import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ProfileRepository,
  TaskRepository,
} from '../database/repositories';
import { ANALYSIS_TASK_STATUS } from '../database/schema/comman';
import { AuthContext } from './auth-context.service';

@Injectable()
export class TaskService {
  constructor(
    private readonly authContext: AuthContext,
    private readonly profileRepository: ProfileRepository,
    private readonly taskRepository: TaskRepository,
  ) {}

  async createTask(buildingId: string, filePath: string): Promise<string> {
    const profileId = this.authContext.getProfileId();
    const organizationId =
      await this.profileRepository.findOrganizationIdByProfileId(profileId);

    if (!organizationId) {
      throw new NotFoundException(`Profile not found: ${profileId}`);
    }

    return this.taskRepository.createPendingTask({
      organizationId,
      profilesId: profileId,
      buildingId,
      filePath,
    });
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

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
