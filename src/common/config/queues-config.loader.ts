import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const QUEUES_CONFIG_PATH = join(process.cwd(), 'config', 'queues.yaml');

export interface QueuesConfig {
  csAnalysisQueue?: {
    defaultJobOptions?: {
      removeOnComplete?: boolean;
      attempts?: number;
      backoff?: { type: string; delay?: number; jitter?: number };
    };
  };
}

function loadQueuesConfig(): QueuesConfig {
  if (!existsSync(QUEUES_CONFIG_PATH)) {
    return {};
  }
  const raw = readFileSync(QUEUES_CONFIG_PATH, 'utf-8');
  const parsed = parseYaml(raw) as QueuesConfig | null;
  return parsed ?? {};
}

/**
 * ConfigModule loader: merges config/queues.yaml under key "queues".
 * Use ConfigService.get<QueuesConfig>('queues') to read.
 */
export function queuesConfigLoader(): { queues: QueuesConfig } {
  return { queues: loadQueuesConfig() };
}
