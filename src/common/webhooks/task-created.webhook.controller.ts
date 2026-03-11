import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../decorators';
import { QueueTaskService } from '../queue/queue-task.service';

/** Supabase Database Webhook INSERT payload for analysis_tasks. */
interface SupabaseInsertPayload {
  type: 'INSERT';
  table: string;
  schema: string;
  record: {
    id: string;
    organization_id: string;
    [key: string]: unknown;
  };
  old_record: null;
}

@Controller('webhooks/supabase')
export class TaskCreatedWebhookController {
  private readonly logger = new Logger(TaskCreatedWebhookController.name);

  constructor(
    private readonly queueTaskService: QueueTaskService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Receives Supabase Database Webhook on INSERT into common.analysis_tasks.
   * Enqueues an analysis job. Use @Public() so Supabase (no JWT) can call this.
   */
  @Public()
  @Post('task-created')
  @HttpCode(HttpStatus.OK)
  async handleTaskCreated(
    @Headers('x-webhook-secret') webhookSecret: string | undefined,
    @Body() body: SupabaseInsertPayload,
  ): Promise<{ ok: true }> {
    const expectedSecret = this.config.get<string>('SUPABASE_WEBHOOK_SECRET');
    if (expectedSecret != null && expectedSecret !== '') {
      if (webhookSecret !== expectedSecret) {
        throw new UnauthorizedException('webhook.invalid_secret');
      }
    }

    if (!body || typeof body !== 'object') {
      throw new BadRequestException('webhook.invalid_body');
    }
    if (body.type !== 'INSERT') {
      throw new BadRequestException('webhook.expected_insert');
    }
    if (body.table !== 'analysis_tasks' || body.schema !== 'common') {
      throw new BadRequestException('webhook.unexpected_table');
    }

    const record = body.record;
    if (!record || typeof record !== 'object') {
      throw new BadRequestException('webhook.missing_record');
    }
    const taskId = record.id;
    const organizationId = record.organization_id;
    if (
      typeof taskId !== 'string' ||
      !taskId ||
      typeof organizationId !== 'string' ||
      !organizationId
    ) {
      throw new BadRequestException('webhook.missing_task_id_or_org_id');
    }

    try {
      this.queueTaskService.enqueueAnalysisJob(taskId, organizationId);
      return { ok: true };
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn(
          `Task not found for webhook: taskId=${taskId}, organizationId=${organizationId}`,
        );
        throw error;
      }
      throw error;
    }
  }
}
