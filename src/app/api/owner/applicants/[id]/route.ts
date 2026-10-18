import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/schema";
import {
  audit,
  currentUser,
  hasPermission,
  requestIp,
  verifySameOrigin,
} from "@/lib/security";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Ctx) {
  try {
    verifySameOrigin(request);
    const actor = await currentUser();
    if (!actor || !hasPermission(actor, "applicants.manage"))
      return new NextResponse("Forbidden", { status: 403 });
    const { id } = await params;
    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target || target.role !== "APPLICANT")
      return new NextResponse("Not found", { status: 404 });
    const form = await request.formData(),
      action = String(form.get("action") || "");
    if (action !== "disable" && action !== "enable")
      return new NextResponse("Invalid action", { status: 400 });
    await db
      .update(users)
      .set({
        status: action === "disable" ? "DISABLED" : "ACTIVE",
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    if (action === "disable")
      await db.delete(sessions).where(eq(sessions.userId, id));
    await audit(
      "applicant.account_updated",
      `Applicant ${id}: ${action}`,
      actor.id,
      requestIp(request),
    );
    return NextResponse.redirect(
      new URL("/admin/applicants", request.url),
      303,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "CSRF")
      return new NextResponse("Invalid request origin", { status: 403 });
    return new NextResponse("Unable to update account", { status: 500 });
  }
}
