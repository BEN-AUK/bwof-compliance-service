import { defineConfig } from 'drizzle-kit';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString?.trim()) {
  throw new Error(
    'DATABASE_URL is required for Drizzle. Set it in .env or .env.local.',
  );
}

export default defineConfig({
  schema: [
    './src/common/database/schema/base.ts',
    './src/common/database/schema/setup.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
  },
  schemaFilter: ["base", "setup"],
});
