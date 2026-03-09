import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProfileRepository, TaskRepository } from './database/repositories';
import { AiService } from './services/ai.service';
import { AuthContext } from './services/auth-context.service';
import { BucketService } from './services/bucket.service';
import { FileService } from './services/file.service';
import { InfraService } from './services/infra.service';
import { TaskService } from './services/task.service';

@Global()
@Module({
  imports: [ConfigModule],
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
  ],
})
export class InfraModule {}
