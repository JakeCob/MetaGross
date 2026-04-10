import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export const db = drizzle('./metagross.db', { schema });
