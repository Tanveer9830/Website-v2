import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applications, reviewEvents, users } from "@/lib/schema";
import {
  allowPermission,
  audit,
  canViewApplication,
  currentUser,
  requestIp,
  verifySameOrigin,
} from "@/lib/security";
import { statusSchema } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  try {
    verifySameOrigin(request);
    const user = await currentUser();
    if (!user)
      return NextResponse.redirect(new URL("/login", request.url), 303);
    if (!["SUPER_OWNER", "ADMIN", "REVIEWER"].includes(user.role))
      return new NextResponse("Forbidden", { status: 403 });
    const { id } = await params;
    const [application] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .limit(1);
    if (!application || !canViewApplication(user, application))
      return new NextResponse("Forbidden", { status: 403 });
    const form = await request.formData();
    const action = String(form.get("action") || "");
    let detail = "";
    if (action === "status") {
      allowPermission(user, "applications.review");
      const value = statusSchema.safeParse(form.get("status"));
      if (!value.success)
        return new NextResponse("Invalid status", { status: 400 });
      const old = application.status;
      await db
        .update(applications)
        .set({ status: value.data, updatedAt: new Date() })
        .where(eq(applications.id, id));
      detail = `${old} → ${value.data}`;
      await db.insert(reviewEvents).values({
        id: randomUUID(),
        applicationId: id,
        actorId: user.id,
        kind: "STATUS",
        content: detail,
        visibleToApplicant: true,
      });
      await audit(
        "application.status_changed",
        `Application ${id}: ${detail}`,
        user.id,
        requestIp(request),
      );
    } else if (action === "note" || action === "message") {
      allowPermission(user, "applications.review");
      const content = String(form.get("content") || "").trim();
      if (!content || content.length > 5000)
        return new NextResponse(
          "Review text is required and must be 5,000 characters or fewer.",
          { status: 400 },
        );
      await db.insert(reviewEvents).values({
        id: randomUUID(),
        applicationId: id,
        actorId: user.id,
        kind: action === "note" ? "NOTE" : "MESSAGE",
        content,
        visibleToApplicant: action === "message",
      });
      await audit(
        `application.${action}`,
        `Application ${id}`,
        user.id,
        requestIp(request),
      );
    } else if (action === "assign") {
      allowPermission(user, "applications.assign");
      const reviewerId = String(form.get("reviewerId") || "");
      const [reviewer] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, reviewerId), eq(users.status, "ACTIVE")))
        .limit(1);
      if (
        !reviewer ||
        !(
          reviewer.role === "REVIEWER" ||
          (reviewer.role === "ADMIN" &&
            reviewer.permissions.includes("applications.read") &&
            reviewer.permissions.includes("applications.review"))
        )
      )
        return new NextResponse(
          "Choose an active staff member with application review permissions.",
          { status: 400 },
        );
      await db
        .update(applications)
        .set({ assignedToId: reviewer.id, updatedAt: new Date() })
        .where(eq(applications.id, id));
      detail = `Assigned to ${reviewer.username}`;
      await db.insert(reviewEvents).values({
        id: randomUUID(),
        applicationId: id,
        actorId: user.id,
        kind: "ASSIGNMENT",
        content: detail,
        visibleToApplicant: false,
      });
      await audit(
        "application.assigned",
        `Application ${id} assigned to staff ${reviewer.id}`,
        user.id,
        requestIp(request),
      );
    } else return new NextResponse("Invalid action", { status: 400 });
    return NextResponse.redirect(
      new URL(`/admin/applications/${id}?saved=1`, request.url),
      303,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN")
      return new NextResponse("Forbidden", { status: 403 });
    if (error instanceof Error && error.message === "CSRF")
      return new NextResponse("Invalid request origin", { status: 403 });
    return new NextResponse("Unable to save review update", { status: 500 });
  }
}
