import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { auditLogs, rateLimits, sessions, users } from "./schema";

export type UserRecord = typeof users.$inferSelect;
export const PERMISSIONS = [
  "applications.read",
  "applications.review",
  "applications.assign",
  "positions.manage",
  "applicants.manage",
  "audit.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
const COOKIE = "top_cloud_session";
const SESSION_SECONDS = 60 * 60 * 8;
const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function hasPermission(
  user: Pick<UserRecord, "role" | "permissions">,
  permission: Permission,
) {
  return (
    user.role === "SUPER_OWNER" ||
    ((user.role === "ADMIN" || user.role === "REVIEWER") &&
      user.permissions.includes(permission))
  );
}
export function canViewApplication(
  user: UserRecord,
  application: { applicantId: string; assignedToId: string | null },
) {
  if (user.role === "SUPER_OWNER") return true;
  if (user.role === "APPLICANT") return user.id === application.applicantId;
  if (!hasPermission(user, "applications.read")) return false;
  return user.role !== "REVIEWER" || application.assignedToId === user.id;
}
export function requireRole(
  user: UserRecord | null,
  roles: UserRecord["role"][],
): UserRecord {
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect("/forbidden");
  return user;
}
export function allowPermission(user: UserRecord, permission: Permission) {
  if (!hasPermission(user, permission)) throw new Error("FORBIDDEN");
}
export async function currentUser(): Promise<UserRecord | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users, sessionId: sessions.id })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
        eq(users.status, "ACTIVE"),
      ),
    )
    .limit(1);
  return row?.user ?? null;
}
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  await db.insert(sessions).values({
    id: randomUUID(),
    tokenHash: hashToken(token),
    userId,
    expiresAt,
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token)
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  jar.set(COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
export function verifySameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    url.host;
  const expected = (process.env.APP_ORIGIN || `${proto}://${host}`).replace(
    /\/$/,
    "",
  );
  if (!origin || origin.replace(/\/$/, "") !== expected)
    throw new Error("CSRF");
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none")
    throw new Error("CSRF");
}
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowSeconds * 1000);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStartedAt: now, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.windowStartedAt} < ${cutoff} THEN 1 ELSE ${rateLimits.count}+1 END`,
        windowStartedAt: sql`CASE WHEN ${rateLimits.windowStartedAt} < ${cutoff} THEN ${now} ELSE ${rateLimits.windowStartedAt} END`,
      },
    })
    .returning({ count: rateLimits.count });
  return (row?.count ?? 0) <= limit;
}
export function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  ).slice(0, 64);
}
export async function audit(
  event: string,
  detail: string,
  actorId: string | null,
  ipAddress = "",
) {
  await db.insert(auditLogs).values({
    id: randomUUID(),
    event,
    detail: detail.slice(0, 500),
    actorId,
    ipAddress: ipAddress.slice(0, 64),
  });
}
export async function appUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/account/password");
  return user;
}
