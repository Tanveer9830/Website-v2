import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  pool?: Pool;
  database?: ReturnType<typeof drizzle>;
};
if (
  !process.env.DATABASE_URL &&
  process.env.NODE_ENV !== "test" &&
  process.env.NEXT_PHASE !== "phase-production-build"
)
  throw new Error("DATABASE_URL is required at runtime.");
const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
export const db = globalForDb.database ?? drizzle(pool, { schema });
if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
  globalForDb.database = db;
}
export { pool };
