import type { DefaultJobOptions } from 'bullmq';

/** Queue name for CS document analysis jobs. Use with InjectQueue(CS_ANALYSIS_QUEUE). */
export const CS_ANALYSIS_QUEUE = 'CS_ANALYSIS_QUEUE';

/** Job name for add(name, data, opts). One queue can have multiple job names. */
export const CS_ANALYSIS_JOB_NAME = 'analyze';

/** Payload for CS analysis jobs. ID-First: only taskId, no large business data. */
export interface CsAnalysisJobPayload {
  taskId: string;
}

/** Shape of config/queues.yaml under "queues" (csAnalysisQueue.defaultJobOptions). */
export interface CsAnalysisQueueConfigShape {
  csAnalysisQueue?: {
    defaultJobOptions?: Partial<DefaultJobOptions>;
  };
}

/**
 * Build DefaultJobOptions from config/queues.yaml only (loaded as ConfigService.get('queues')).
 * No code defaults; all values must be present in config.
 */
export function getCsAnalysisQueueDefaultJobOptions(
  queuesConfig: CsAnalysisQueueConfigShape | undefined,
): DefaultJobOptions {
  const opts = queuesConfig?.csAnalysisQueue?.defaultJobOptions ?? {};
  return {
    removeOnComplete: opts.removeOnComplete,
    attempts: opts.attempts,
    backoff: opts.backoff,
  };
}
