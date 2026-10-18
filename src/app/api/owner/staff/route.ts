import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import {
  audit,
  currentUser,
  PERMISSIONS,
  requestIp,
  verifySameOrigin,
} from "@/lib/security";
import { staffSchema } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const owner = await currentUser();
    if (owner?.role !== "SUPER_OWNER")
      return new NextResponse("Forbidden", { status: 403 });
    const form = await request.formData();
    const parsed = staffSchema.safeParse({
      ...Object.fromEntries(form),
      permissions: form.getAll("permissions"),
    });
    if (!parsed.success || parsed.data.username === "tanveer")
      return NextResponse.redirect(
        new URL("/admin/owner?error=staff", request.url),
        303,
      );
    const { username, email, password, role } = parsed.data;
    const permissions =
      role === "REVIEWER"
        ? ["applications.read", "applications.review"]
        : parsed.data.permissions.filter(
            (p): p is (typeof PERMISSIONS)[number] =>
              PERMISSIONS.includes(p as (typeof PERMISSIONS)[number]),
          );
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    const [created] = await db
      .insert(users)
      .values({
        id: randomUUID(),
        username,
        email,
        passwordHash,
        role,
        permissions,
        mustChangePassword: true,
      })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (!created)
      return NextResponse.redirect(
        new URL("/admin/owner?error=duplicate", request.url),
        303,
      );
    await audit(
      "staff.created",
      `Created ${role} account ${username}`,
      owner.id,
      requestIp(request),
    );
    return NextResponse.redirect(
      new URL("/admin/owner#staff", request.url),
      303,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "CSRF")
      return new NextResponse("Invalid request origin", { status: 403 });
    return NextResponse.redirect(
      new URL("/admin/owner?error=staff", request.url),
      303,
    );
  }
}
