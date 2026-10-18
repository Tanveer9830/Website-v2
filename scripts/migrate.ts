import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString)
  throw new Error("DATABASE_URL is required to run migrations.");
const client = new Client({ connectionString });
async function main() {
  await client.connect();
  await client.query("SELECT pg_advisory_lock($1)", [778410230]);
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const done = new Set(
      (
        await client.query<{ name: string }>(
          "SELECT name FROM schema_migrations",
        )
      ).rows.map((row) => row.name),
    );
    const dir = path.join(process.cwd(), "migrations");
    const files = (await readdir(dir))
      .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name))
      .sort();
    for (const name of files) {
      if (done.has(name)) continue;
      const sql = await readFile(path.join(dir, name), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
          name,
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      console.log(`Applied migration ${name}`);
    }
    console.log("Database migrations are up to date.");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [778410230]);
    await client.end();
  }
}
main().catch((error) => {
  console.error(
    "Migration failed:",
    error instanceof Error ? error.message : "unknown error",
  );
  process.exitCode = 1;
});
