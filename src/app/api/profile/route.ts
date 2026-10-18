import { and, eq, ne, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import {
  audit,
  currentUser,
  requestIp,
  verifySameOrigin,
} from "@/lib/security";
export const runtime = "nodejs";
const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[a-zA-Z0-9_]+$/)
    .transform((v) => v.toLowerCase()),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
});
export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await currentUser();
    if (!user)
      return NextResponse.redirect(new URL("/login", request.url), 303);
    if (user.role !== "APPLICANT")
      return new NextResponse("Forbidden", { status: 403 });
    const parsed = profileSchema.safeParse(
      Object.fromEntries(await request.formData()),
    );
    if (!parsed.success || parsed.data.username === "tanveer")
      return NextResponse.redirect(
        new URL("/dashboard?error=profile", request.url),
        303,
      );
    const { username, email } = parsed.data;
    const [conflict] = await db
      .select({ id: users.id })
      .from(users)
      .where(andNotSelf(user.id, username, email))
      .limit(1);
    if (conflict)
      return NextResponse.redirect(
        new URL("/dashboard?error=profile", request.url),
        303,
      );
    await db
      .update(users)
      .set({ username, email, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await audit(
      "account.profile_updated",
      "Applicant profile updated",
      user.id,
      requestIp(request),
    );
    return NextResponse.redirect(
      new URL("/dashboard?profile=updated", request.url),
      303,
    );
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        `/dashboard?error=${error instanceof Error && error.message === "CSRF" ? "csrf" : "profile"}`,
        request.url,
      ),
      303,
    );
  }
}
function andNotSelf(userId: string, username: string, email: string) {
  return and(
    ne(users.id, userId),
    or(eq(users.username, username), eq(users.email, email)),
  );
}
