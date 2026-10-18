import { randomUUID } from "node:crypto";
import { and, eq, gte, isNull, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  applications,
  positions,
  reviewEvents,
  siteSettings,
} from "@/lib/schema";
import {
  currentUser,
  requestIp,
  audit,
  verifySameOrigin,
} from "@/lib/security";
import { validateAnswers } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await currentUser();
    if (!user)
      return NextResponse.redirect(new URL("/login", request.url), 303);
    if (user.role !== "APPLICANT")
      return new NextResponse("Forbidden", { status: 403 });
    const form = await request.formData();
    const positionId = String(form.get("positionId") || "");
    const [position] = await db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.id, positionId),
          eq(positions.isOpen, true),
          or(
            isNull(positions.deadline),
            gte(positions.deadline, new Date().toISOString().slice(0, 10)),
          ),
        ),
      )
      .limit(1);
    const [maintenance] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, "maintenance_mode"))
      .limit(1);
    if (!position || maintenance?.value === "true")
      return NextResponse.redirect(
        new URL("/dashboard?error=closed", request.url),
        303,
      );
    const { answers, errors } = validateAnswers(position.formSchema, form);
    if (errors.length)
      return NextResponse.redirect(
        new URL(`/dashboard/apply/${positionId}?error=validation`, request.url),
        303,
      );
    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(applications).values({
        id,
        applicantId: user.id,
        positionId: position.id,
        positionTitle: position.title,
        answers,
        schemaSnapshot: position.formSchema,
      });
      await tx.insert(reviewEvents).values({
        id: randomUUID(),
        applicationId: id,
        actorId: user.id,
        kind: "STATUS",
        content: "Application submitted · Pending",
        visibleToApplicant: true,
      });
    });
    await audit(
      "application.submitted",
      `Application ${id} submitted`,
      user.id,
      requestIp(request),
    );
    return NextResponse.redirect(
      new URL("/dashboard?submitted=1", request.url),
      303,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "CSRF")
      return new NextResponse("Invalid request origin", { status: 403 });
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    )
      return NextResponse.redirect(
        new URL("/dashboard?error=duplicate", request.url),
        303,
      );
    return new NextResponse("Unable to submit application", { status: 500 });
  }
}
