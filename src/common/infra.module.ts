import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProfileRepository, TaskRepository } from './database/repositories';
import { QueueModule } from './queue/queue.module';
import { AiService } from './services/ai.service';
import { AuthContext } from './services/auth-context.service';
import { BucketService } from './services/bucket.service';
import { FileService } from './services/file.service';
import { InfraService } from './services/infra.service';
import { TaskService } from './services/task.service';
import { TaskCreatedWebhookController } from './webhooks/task-created.webhook.controller';

@Global()
@Module({
  imports: [ConfigModule, QueueModule],
  controllers: [TaskCreatedWebhookController],
  providers: [
    ProfileRepository,
    TaskRepository,
    InfraService,
    BucketService,
    AiService,
    AuthContext,
    FileService,
    TaskService,
  ],
  exports: [
    ProfileRepository,
    TaskRepository,
    InfraService,
    BucketService,
    AiService,
    AuthContext,
    FileService,
    TaskService,
    QueueModule,
  ],
})
export class InfraModule {}
