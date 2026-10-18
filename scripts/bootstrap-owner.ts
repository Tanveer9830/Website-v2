import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/lib/db";
import { auditLogs, users } from "../src/lib/schema";

async function secret(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdin.setRawMode)
    throw new Error(
      "A private interactive terminal is required to enter the Super Owner password.",
    );
  stdout.write(prompt);
  return new Promise((resolve, reject) => {
    let result = "";
    const onData = (buffer: Buffer) => {
      for (const byte of buffer) {
        if (byte === 3) {
          stdin.off("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          reject(new Error("Cancelled."));
          return;
        }
        if (byte === 13 || byte === 10) {
          stdin.off("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          resolve(result);
          return;
        }
        if (byte === 127 || byte === 8) {
          result = result.slice(0, -1);
          continue;
        }
        if (byte >= 32 && byte <= 126) result += String.fromCharCode(byte);
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}
async function main() {
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "SUPER_OWNER"))
    .limit(1);
  if (owner) {
    console.log(
      "A Super Owner already exists. No account or password was modified.",
    );
    return;
  }
  const input = createInterface({ input: stdin, output: stdout });
  const email = (await input.question("Super Owner email address: "))
    .trim()
    .toLowerCase();
  input.close();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error("Please provide a valid email address.");
  if (
    await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, "tanveer"))
      .then((rows) => rows.length)
  )
    throw new Error(
      "The reserved tanveer username is already registered. Resolve the account safely before bootstrap.",
    );
  const password = await secret(
    "Set a private password for tanveer (12+ chars): ",
  );
  const confirm = await secret("Confirm password: ");
  if (password.length < 12 || password.length > 128 || password !== confirm)
    throw new Error(
      "Password must be 12–128 characters and both entries must match.",
    );
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      username: "tanveer",
      email,
      passwordHash,
      role: "SUPER_OWNER",
      permissions: [],
      mustChangePassword: false,
    });
    await tx.insert(auditLogs).values({
      id: randomUUID(),
      actorId: id,
      event: "owner.bootstrapped",
      detail: "Initial Super Owner provisioned by local command",
      ipAddress: "local-cli",
    });
  });
  console.log(
    "TOP CLOUD Super Owner tanveer created. Credentials were not printed or stored outside the password hash. Sign in at /login.",
  );
}
main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Owner bootstrap failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
