import argon2 from "argon2";
import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import {
  audit,
  rateLimit,
  requestIp,
  startSession,
  verifySameOrigin,
} from "@/lib/security";
import { loginSchema } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const ip = requestIp(request);
    if (!(await rateLimit(`login:${ip}`, 10, 600)))
      return NextResponse.redirect(
        new URL("/login?error=slow-down", request.url),
        303,
      );
    const data = Object.fromEntries(await request.formData());
    const parsed = loginSchema.safeParse(data);
    if (!parsed.success)
      return NextResponse.redirect(
        new URL("/login?error=details", request.url),
        303,
      );
    const account = parsed.data.account.toLowerCase();
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.username, account), eq(users.email, account)))
      .limit(1);
    let valid = false;
    if (user?.status === "ACTIVE") {
      try {
        valid = await argon2.verify(user.passwordHash, parsed.data.password);
      } catch {
        valid = false;
      }
    }
    if (!valid) {
      await audit(
        "auth.login_failed",
        "Sign-in attempt rejected",
        user?.id ?? null,
        ip,
      );
      return NextResponse.redirect(
        new URL("/login?error=details", request.url),
        303,
      );
    }
    await startSession(user.id);
    await audit("auth.login", "Successful sign-in", user.id, ip);
    const to = user.mustChangePassword
      ? "/account/password"
      : user.role === "SUPER_OWNER"
        ? "/admin/owner"
        : user.role === "ADMIN" || user.role === "REVIEWER"
          ? "/admin"
          : "/dashboard";
    return NextResponse.redirect(new URL(to, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${error instanceof Error && error.message === "CSRF" ? "csrf" : "server"}`,
        request.url,
      ),
      303,
    );
  }
}
