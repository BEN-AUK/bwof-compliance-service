import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Injection token for the Drizzle database instance. */
export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = PostgresJsDatabase;

/**
 * Builds the Drizzle + postgres.js client for Supabase PostgreSQL.
 * Uses DATABASE_URL from environment. Disables prepared statements for
 * Supabase (and similar pooler) compatibility.
 */
function createDrizzle(config: ConfigService): DrizzleDB {
  const url = config.get<string>('DATABASE_URL');
  if (!url || url.trim() === '') {
    throw new Error(
      'DATABASE_URL is required. Set it in .env or environment.',
    );
  }

  const client = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

  return drizzle({ client }) as DrizzleDB;
}

export const databaseProvider: Provider<DrizzleDB> = {
  provide: DRIZZLE,
  inject: [ConfigService],
  useFactory(config: ConfigService): DrizzleDB {
    try {
      return createDrizzle(config);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Database connection failed: ${message}`);
    }
  },
};
