import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './services/ai.service';
import { BucketService } from './services/bucket.service';
import { FileService } from './services/file.service';
import { InfraService } from './services/infra.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [InfraService, BucketService, AiService, FileService],
  exports: [InfraService, BucketService, AiService, FileService],
})
export class InfraModule {}
