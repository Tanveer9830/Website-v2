import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { audit, rateLimit, requestIp, verifySameOrigin } from "@/lib/security";
import { registrationSchema } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    if (!(await rateLimit(`register:${requestIp(request)}`, 5, 3600)))
      return NextResponse.redirect(
        new URL("/register?error=slow-down", request.url),
        303,
      );
    const data = Object.fromEntries(await request.formData());
    const parsed = registrationSchema.safeParse({
      username: data.username,
      email: data.email,
      password: data.password,
    });
    if (!parsed.success)
      return NextResponse.redirect(
        new URL("/register?error=details", request.url),
        303,
      );
    const { username, email, password } = parsed.data;
    if (username.toLowerCase() === "tanveer")
      return NextResponse.redirect(
        new URL("/register?error=details", request.url),
        303,
      );
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    const [created] = await db
      .insert(users)
      .values({ id: randomUUID(), username, email, passwordHash: hash })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (!created)
      return NextResponse.redirect(
        new URL("/register?error=duplicate", request.url),
        303,
      );
    await audit(
      "account.registered",
      "Applicant account created",
      created.id,
      requestIp(request),
    );
    return NextResponse.redirect(new URL("/login?created=1", request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        `/register?error=${error instanceof Error && error.message === "CSRF" ? "csrf" : "server"}`,
        request.url,
      ),
      303,
    );
  }
}
