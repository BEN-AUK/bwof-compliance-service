import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'bullmq';

export function getRedisConnectionOptions(config: ConfigService): RedisOptions {
  const host = config.get<string>('REDIS_HOST') ?? 'localhost';
  const port = Number(config.get<string>('REDIS_PORT')) || 6379;
  const password = config.get<string>('REDIS_PASSWORD');
  const dbRaw = config.get<string>('REDIS_DB');
  const db = dbRaw !== undefined && dbRaw !== '' ? Number(dbRaw) : 0;

  const options: RedisOptions = { host, port, db };
  if (password !== undefined && password !== '') {
    options.password = password;
  }
  return options;
}
