import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/schema";
import {
  audit,
  currentUser,
  requestIp,
  startSession,
  verifySameOrigin,
} from "@/lib/security";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await currentUser();
    if (!user)
      return NextResponse.redirect(new URL("/login", request.url), 303);
    const form = await request.formData();
    const old = String(form.get("current_password") || ""),
      next = String(form.get("new_password") || "");
    if (
      next.length < 12 ||
      next.length > 128 ||
      !(await argon2.verify(user.passwordHash, old))
    )
      return NextResponse.redirect(
        new URL("/account/password?error=details", request.url),
        303,
      );
    const passwordHash = await argon2.hash(next, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    await db
      .update(users)
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await startSession(user.id);
    await audit(
      "auth.password_changed",
      "Password changed; other sessions revoked",
      user.id,
      requestIp(request),
    );
    return NextResponse.redirect(
      new URL(
        user.role === "SUPER_OWNER"
          ? "/admin/owner"
          : user.role === "ADMIN" || user.role === "REVIEWER"
            ? "/admin"
            : "/dashboard",
        request.url,
      ),
      303,
    );
  } catch {
    return NextResponse.redirect(
      new URL("/account/password?error=csrf", request.url),
      303,
    );
  }
}
