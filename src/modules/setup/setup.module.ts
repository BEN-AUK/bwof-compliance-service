import { Module } from '@nestjs/common';
import { SetupController } from './controllers/setup.controller';
import { BuildingComplianceSchemaService } from './services/building-compliance-schema.service';
import { CsDocumentAnalyzeService } from './services/cs-document-analyze.service';
import { IdFuzzyMatchService } from './services/id-fuzzy-match.service';
import { TaskProcessor } from './queue/task-processor';
import { QueueModule } from '../../common/queue/queue.module';

/**
 * SetupModule - 统一处理 buildings, documents, category, inspections 的联合落库事务。
 * 遵循 DDD：仅通过本模块 Service 暴露能力，禁止跨模块直接操作 Repository。
 */
@Module({
  imports: [QueueModule],
  controllers: [SetupController],
  providers: [
    BuildingComplianceSchemaService,
    CsDocumentAnalyzeService,
    IdFuzzyMatchService,
    TaskProcessor,
  ],
  exports: [CsDocumentAnalyzeService],
})
export class SetupModule {}
