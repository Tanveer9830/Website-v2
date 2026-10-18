import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
let pg: PGlite;
describe("PostgreSQL schema migration", () => {
  beforeAll(async () => {
    pg = new PGlite();
    await pg.exec(
      await readFile(
        resolve(process.cwd(), "migrations/0001_initial.sql"),
        "utf8",
      ),
    );
  });
  afterAll(async () => {
    await pg.close();
  });
  it("creates the persistent core schema, indexes, and application enums", async () => {
    const tables = await pg.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public'",
    );
    const names = tables.rows.map((r) => r.table_name);
    expect(names).toContain("users");
    expect(names).toContain("applications");
    expect(names).toContain("review_events");
    expect(names).toContain("sessions");
    expect(names).toContain("rate_limits");
    const enums = await pg.query<{ enumlabel: string }>(
      "SELECT enumlabel FROM pg_enum WHERE enumtypid='application_status'::regtype",
    );
    expect(enums.rows.map((r) => r.enumlabel)).toEqual([
      "PENDING",
      "REVIEWING",
      "UNDER_CONSIDERATION",
      "APPROVED",
      "REJECTED",
      "ON_HOLD",
    ]);
  });
  it("enforces unique applicant-per-position submissions", async () => {
    await pg.query(
      "INSERT INTO users(id,username,email,password_hash,role) VALUES('u1','applicant','a@example.org','argon-hash','APPLICANT')",
    );
    await pg.query(
      "INSERT INTO positions(id,title,description) VALUES('p1','Support','Support role')",
    );
    await pg.query(
      "INSERT INTO applications(id,applicant_id,position_id,position_title,answers,schema_snapshot) VALUES('a1','u1','p1','Support','{}','[]')",
    );
    await expect(
      pg.query(
        "INSERT INTO applications(id,applicant_id,position_id,position_title,answers,schema_snapshot) VALUES('a2','u1','p1','Support','{}','[]')",
      ),
    ).rejects.toThrow();
  });
});
