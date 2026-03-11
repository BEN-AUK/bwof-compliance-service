import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import {
  CS_ANALYSIS_QUEUE,
  getCsAnalysisQueueDefaultJobOptions,
  type CsAnalysisQueueConfigShape,
} from './constants';
import { getRedisConnectionOptions } from './redis-options.helper';
import { QueueTaskService } from './queue-task.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: getRedisConnectionOptions(config),
      }),
    }),
    BullModule.registerQueueAsync({
      name: CS_ANALYSIS_QUEUE,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        name: CS_ANALYSIS_QUEUE,
        defaultJobOptions: getCsAnalysisQueueDefaultJobOptions(
          config.get<CsAnalysisQueueConfigShape>('queues'),
        ),
      }),
    }),
  ],
  providers: [QueueTaskService],
  exports: [QueueTaskService],
})
export class QueueModule {}
