import { randomUUID } from "node:crypto";
import { stdin, stdout } from "node:process";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/lib/db";
import { auditLogs, sessions, users } from "../src/lib/schema";
async function secret(prompt: string) {
  if (!stdin.isTTY || !stdin.setRawMode)
    throw new Error("A private interactive terminal is required.");
  stdout.write(prompt);
  return new Promise<string>((resolve, reject) => {
    let value = "";
    const onData = (b: Buffer) => {
      for (const c of b) {
        if (c === 3) {
          stdin.off("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          reject(new Error("Cancelled."));
          return;
        }
        if (c === 10 || c === 13) {
          stdin.off("data", onData);
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (c === 8 || c === 127) {
          value = value.slice(0, -1);
          continue;
        }
        if (c >= 32 && c <= 126) value += String.fromCharCode(c);
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}
async function main() {
  const username = (process.argv[2] || "").toLowerCase();
  if (!username) throw new Error("Usage: npm run account:reset -- <username>");
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!target) throw new Error("Account not found.");
  const password = await secret("New password (12–128 chars): "),
    confirm = await secret("Confirm new password: ");
  if (password.length < 12 || password.length > 128 || password !== confirm)
    throw new Error("Password entries must match and be 12–128 characters.");
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: true, updatedAt: new Date() })
      .where(eq(users.id, target.id));
    await tx.delete(sessions).where(eq(sessions.userId, target.id));
    await tx.insert(auditLogs).values({
      id: randomUUID(),
      actorId: null,
      event: "auth.password_reset_cli",
      detail: `Local-console password reset for user ${target.id}`,
      ipAddress: "local-cli",
    });
  });
  console.log(
    "Password reset. The account must choose a new password at next sign-in; existing sessions were revoked.",
  );
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Password reset failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
