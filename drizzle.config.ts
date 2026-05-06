import { defineConfig } from 'drizzle-kit';

const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
const isTurso = !!tursoUrl && !tursoUrl.startsWith('file:');

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: isTurso ? 'turso' : 'sqlite',
  dbCredentials: isTurso
    ? {
        url: tursoUrl,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : {
        url: process.env.METAGROSS_SQLITE_PATH ?? './data/db/metagross.db',
      },
});
