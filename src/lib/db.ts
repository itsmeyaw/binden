import { drizzle } from "drizzle-orm/neon-http";

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");

  return drizzle(connectionString);
}
