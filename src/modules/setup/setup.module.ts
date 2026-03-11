import { Module } from '@nestjs/common';
import { SetupController } from './controllers/setup.controller';
import { CsDocumentAnalyzeService } from './services/cs-document-analyze.service';
import { QueueModule } from '../../common/queue/queue.module';
import { TaskProcessor } from './queue/task-processor';

/**
 * SetupModule - 统一处理 buildings, documents, category, inspections 的联合落库事务。
 * 遵循 DDD：仅通过本模块 Service 暴露能力，禁止跨模块直接操作 Repository。
 */
@Module({
  imports: [QueueModule],
  controllers: [SetupController],
  providers: [CsDocumentAnalyzeService, TaskProcessor],
  exports: [CsDocumentAnalyzeService],
})
export class SetupModule {}
