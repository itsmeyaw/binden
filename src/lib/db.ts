import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle({ client: pool });

export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  return db;
}
