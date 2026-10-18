import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/schema";
import {
  audit,
  currentUser,
  PERMISSIONS,
  requestIp,
  verifySameOrigin,
} from "@/lib/security";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Ctx) {
  try {
    verifySameOrigin(request);
    const owner = await currentUser();
    if (owner?.role !== "SUPER_OWNER")
      return new NextResponse("Forbidden", { status: 403 });
    const { id } = await params;
    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target || target.role === "SUPER_OWNER")
      return new NextResponse("Forbidden", { status: 403 });
    const form = await request.formData();
    const action = String(form.get("action") || "");
    if (action === "disable" || action === "enable") {
      await db
        .update(users)
        .set({
          status: action === "disable" ? "DISABLED" : "ACTIVE",
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));
      await db.delete(sessions).where(eq(sessions.userId, id));
    } else if (action === "permissions") {
      const role = String(form.get("role") || target.role);
      if (!["ADMIN", "REVIEWER"].includes(role))
        return new NextResponse("Invalid role", { status: 400 });
      const permissions =
        role === "REVIEWER"
          ? ["applications.read", "applications.review"]
          : form
              .getAll("permissions")
              .map(String)
              .filter((p): p is (typeof PERMISSIONS)[number] =>
                PERMISSIONS.includes(p as (typeof PERMISSIONS)[number]),
              );
      await db
        .update(users)
        .set({
          role: role as "ADMIN" | "REVIEWER",
          permissions,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));
    } else return new NextResponse("Invalid action", { status: 400 });
    await audit(
      "staff.updated",
      `Updated staff account ${id}: ${action}`,
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
    return new NextResponse("Unable to update staff access", { status: 500 });
  }
}
