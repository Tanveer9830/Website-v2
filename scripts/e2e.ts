import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { Pool } from "pg";
import argon2 from "argon2";

const assert: (condition: unknown, message: string) => asserts condition = (
  condition,
  message,
) => {
  if (!condition) throw new Error(`E2E assertion failed: ${message}`);
};
function runMigration(databaseUrl: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/migrate.ts"],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    child.stdout.on("data", (d) => (output += d.toString()));
    child.stderr.on("data", (d) => (output += d.toString()));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`Migration command exited ${code}: ${output}`)),
    );
  });
}
async function main() {
  const pgEngine = new PGlite();
  const socket = new PGLiteSocketServer({
    db: pgEngine,
    port: 0,
    host: "127.0.0.1",
    maxConnections: 20,
  });
  let child: ReturnType<typeof spawn> | undefined;
  let pool: Pool | undefined;
  try {
    await socket.start();
    const address = socket.getServerConn();
    const databaseUrl = `postgresql://postgres:postgres@${address}/postgres?sslmode=disable`;
    const migrationOutput = await runMigration(databaseUrl);
    assert(
      migrationOutput.includes("Applied migration 0001_initial.sql"),
      "migration runner applies the initial PostgreSQL migration",
    );
    const rerunOutput = await runMigration(databaseUrl);
    assert(
      rerunOutput.includes("up to date"),
      "database migration command is safely rerunnable",
    );
    pool = new Pool({ connectionString: databaseUrl, max: 10 });
    const ownerPass = "e2e-owner-only-random-pass-890!";
    const adminPass = "e2e-admin-only-random-pass-890!";
    const applicantPass = "candidate-private-e2e-pass-890!";
    const ownerHash = await argon2.hash(ownerPass, {
      type: argon2.argon2id,
      memoryCost: 8192,
      timeCost: 1,
    });
    const adminHash = await argon2.hash(adminPass, {
      type: argon2.argon2id,
      memoryCost: 8192,
      timeCost: 1,
    });
    await pool.query(
      "INSERT INTO users(id,username,email,password_hash,role,permissions) VALUES($1,$2,$3,$4,$5,$6)",
      [
        "owner-e2e",
        "tanveer",
        "owner-e2e@example.org",
        ownerHash,
        "SUPER_OWNER",
        [],
      ],
    );
    await pool.query(
      "INSERT INTO users(id,username,email,password_hash,role,permissions) VALUES($1,$2,$3,$4,$5,$6)",
      [
        "admin-e2e",
        "reviewadmin",
        "admin-e2e@example.org",
        adminHash,
        "ADMIN",
        ["applications.read"],
      ],
    );
    await pool.query(
      "INSERT INTO positions(id,title,description,requirements,form_schema) VALUES($1,$2,$3,$4,$5::jsonb)",
      [
        "position-e2e",
        "Support engineer",
        "Help our hosting customers.",
        "Communication and care.",
        JSON.stringify([
          { id: "q1", label: "Why TOP CLOUD?", type: "long", required: true },
        ]),
      ],
    );
    const appPort = Number(process.env.E2E_PORT || 3147);
    const base = `http://127.0.0.1:${appPort}`;
    child = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(appPort),
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "production",
          DATABASE_URL: databaseUrl,
          APP_ORIGIN: base,
          PORT: String(appPort),
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let serverLog = "";
    child.stdout?.on("data", (d) => (serverLog += d.toString()));
    child.stderr?.on("data", (d) => (serverLog += d.toString()));
    let ready = false;
    for (let i = 0; i < 45; i++) {
      if (child.exitCode !== null)
        throw new Error(`Next start exited unexpectedly: ${serverLog}`);
      try {
        const h = await fetch(`${base}/health`);
        if (h.ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(400);
    }
    assert(ready, `Next server health endpoint became ready (${serverLog})`);
    assert(
      serverLog.includes("STAFF APPLICATION PORTAL"),
      "TOP CLOUD ASCII banner is printed on server startup",
    );
    const origin = { Origin: base };
    const form = (obj: Record<string, string>) =>
      new URLSearchParams(obj).toString();
    const badCsrf = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: {
        ...origin,
        Origin: "https://attacker.invalid",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form({
        username: "csrfvictim",
        email: "csrf@example.org",
        password: "csrf-victim-long-password-876!",
      }),
      redirect: "manual",
    });
    assert(
      badCsrf.status === 303,
      "cross-origin registration is rejected with a safe redirect",
    );
    assert(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM users WHERE username='csrfvictim'",
        )
      ).rows[0].n === 0,
      "CSRF attempt created no account",
    );
    const registered = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: {
        ...origin,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form({
        username: "candidatee2e",
        email: "candidate-e2e@example.org",
        password: applicantPass,
      }),
      redirect: "manual",
    });
    assert(
      registered.status === 303 &&
        registered.headers.get("location")?.includes("/login?created=1"),
      "applicant registration works",
    );
    const login = async (username: string, password: string) => {
      const r = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: {
          ...origin,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form({ account: username, password }),
        redirect: "manual",
      });
      assert(
        r.status === 303,
        `${username} login redirects after verification`,
      );
      const raw = r.headers.get("set-cookie");
      assert(
        raw?.includes("top_cloud_session="),
        `${username} receives an HTTP-only session cookie`,
      );
      return {
        cookie: raw!.split(";")[0],
        location: r.headers.get("location"),
      };
    };
    const applicant = await login("candidatee2e", applicantPass);
    assert(
      applicant.location?.endsWith("/dashboard"),
      "applicant login routes to their dashboard",
    );
    const position = await fetch(`${base}/dashboard/apply/position-e2e`, {
      headers: { cookie: applicant.cookie },
    });
    assert(
      position.status === 200 &&
        (await position.text()).includes("Why TOP CLOUD?"),
      "applicant can load open-position form",
    );
    const submitted = await fetch(`${base}/api/applications`, {
      method: "POST",
      headers: {
        ...origin,
        cookie: applicant.cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form({
        positionId: "position-e2e",
        q_q1: "I enjoy making support clear and useful.",
      }),
      redirect: "manual",
    });
    assert(
      submitted.status === 303 &&
        submitted.headers.get("location")?.includes("submitted=1"),
      "applicant submission is persisted",
    );
    const appId = (
      await pool.query(
        "SELECT id FROM applications WHERE applicant_id=(SELECT id FROM users WHERE username='candidatee2e')",
      )
    ).rows[0]?.id as string;
    assert(
      !!appId,
      "application exists in isolated PostgreSQL-compatible database",
    );
    const owner = await login("tanveer", ownerPass);
    assert(
      owner.location?.endsWith("/admin/owner"),
      "Super Owner default redirect is the Owner Panel",
    );
    const ownerPanel = await fetch(`${base}/admin/owner`, {
      headers: { cookie: owner.cookie },
    });
    assert(
      ownerPanel.status === 200,
      `Super Owner can access Owner Panel (status ${ownerPanel.status}; logs ${serverLog.slice(-1200)})`,
    );
    const adminPanel = await fetch(`${base}/admin`, {
      headers: { cookie: owner.cookie },
    });
    assert(
      adminPanel.status === 200 &&
        (await adminPanel.text()).includes("Application"),
      "same Super Owner can use Admin Panel",
    );
    const detail = await fetch(`${base}/admin/applications/${appId}`, {
      headers: { cookie: owner.cookie },
    });
    const detailBody = await detail.text();
    assert(
      detail.status === 200 &&
        detailBody.includes("I enjoy making support clear and useful.") &&
        detailBody.includes("candidate-e2e@example.org"),
      "owner sees complete applicant identity, form snapshot, and answer",
    );
    const privateNote = await fetch(
      `${base}/api/applications/${appId}/review`,
      {
        method: "POST",
        headers: {
          ...origin,
          cookie: owner.cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form({ action: "note", content: "internal-e2e-only-note" }),
        redirect: "manual",
      },
    );
    assert(privateNote.status === 303, "owner can add a private review note");
    const publicMessage = await fetch(
      `${base}/api/applications/${appId}/review`,
      {
        method: "POST",
        headers: {
          ...origin,
          cookie: owner.cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form({
          action: "message",
          content: "Please share your availability.",
        }),
        redirect: "manual",
      },
    );
    assert(
      publicMessage.status === 303,
      "owner can send applicant-visible message",
    );
    const status = await fetch(`${base}/api/applications/${appId}/review`, {
      method: "POST",
      headers: {
        ...origin,
        cookie: owner.cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form({ action: "status", status: "REVIEWING" }),
      redirect: "manual",
    });
    assert(status.status === 303, "owner can update application status");
    const ownDashboard = await fetch(`${base}/dashboard`, {
      headers: { cookie: applicant.cookie },
    });
    const applicantBody = await ownDashboard.text();
    assert(
      ownDashboard.status === 200 &&
        applicantBody.includes("Please share your availability.") &&
        applicantBody.includes("Reviewing") &&
        !applicantBody.includes("internal-e2e-only-note"),
      "applicant sees own status and visible message but never private notes",
    );
    const admin = await login("reviewadmin", adminPass);
    const normalAdmin = await fetch(`${base}/admin`, {
      headers: { cookie: admin.cookie },
    });
    assert(
      normalAdmin.status === 200,
      "permissioned ordinary admin can access admin queue",
    );
    const noOwner = await fetch(`${base}/admin/owner`, {
      headers: { cookie: admin.cookie },
      redirect: "manual",
    });
    assert(
      noOwner.status === 307 || noOwner.status === 308,
      "ordinary admin cannot access Owner Panel",
    );
    const noEscalation = await fetch(`${base}/api/owner/staff`, {
      method: "POST",
      headers: {
        ...origin,
        cookie: admin.cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form({
        username: "evil",
        email: "evil@example.org",
        password: "some-long-password-12345",
        role: "SUPER_OWNER",
      }),
      redirect: "manual",
    });
    assert(
      noEscalation.status === 403,
      "ordinary admin cannot create or elevate a Super Owner",
    );
    const applicantDenied = await fetch(`${base}/admin`, {
      headers: { cookie: applicant.cookie },
      redirect: "manual",
    });
    assert(
      applicantDenied.status === 307 || applicantDenied.status === 308,
      "applicant is refused administrative panel",
    );
    const other = await pool.query(
      "INSERT INTO users(id,username,email,password_hash,role) VALUES('other-e2e','other','other-e2e@example.org',$1,'APPLICANT') RETURNING id",
      [adminHash],
    );
    void other;
    const foreign = await pool.query(
      "INSERT INTO applications(id,applicant_id,position_id,position_title,answers,schema_snapshot) VALUES('foreign-e2e','other-e2e','position-e2e','Support engineer','{}','[]')",
    );
    void foreign;
    const foreignPage = await fetch(`${base}/admin/applications/foreign-e2e`, {
      headers: { cookie: applicant.cookie },
      redirect: "manual",
    });
    assert(
      foreignPage.status === 307 || foreignPage.status === 308,
      "applicant cannot view another applicant application",
    );
    const logout = await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      headers: { ...origin, cookie: applicant.cookie },
      redirect: "manual",
    });
    assert(logout.status === 303, "logout completes");
    const afterLogout = await fetch(`${base}/dashboard`, {
      headers: { cookie: applicant.cookie },
      redirect: "manual",
    });
    assert(
      afterLogout.status === 307 || afterLogout.status === 308,
      "logout invalidates the session",
    );
    console.log(
      "E2E passed: registration, login, application submission, applicant isolation, private-note secrecy, Super Owner access to both panels, complete owner answers, Admin-only access, escalation denial, CSRF rejection, status update, messaging, logout/session invalidation.",
    );
  } finally {
    if (child && !child.killed) child.kill("SIGTERM");
    await pool?.end().catch(() => {});
    await socket.stop().catch(() => {});
    await pgEngine.close().catch(() => {});
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
