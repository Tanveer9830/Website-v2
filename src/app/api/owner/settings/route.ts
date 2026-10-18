import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { siteSettings } from "@/lib/schema";
import {
  audit,
  currentUser,
  requestIp,
  verifySameOrigin,
} from "@/lib/security";
import { settingsSchema } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const owner = await currentUser();
    if (owner?.role !== "SUPER_OWNER")
      return new NextResponse("Forbidden", { status: 403 });
    const form = await request.formData();
    const parsed = settingsSchema.safeParse({
      about_text: form.get("about_text") || "",
      support_email: form.get("support_email"),
      announcement: form.get("announcement") || "",
      maintenance_mode: form.get("maintenance_mode") === "on" ? "on" : "off",
    });
    if (!parsed.success)
      return NextResponse.redirect(
        new URL("/admin/owner?error=settings", request.url),
        303,
      );
    const entries = [
      ["about_text", parsed.data.about_text],
      ["support_email", parsed.data.support_email],
      ["announcement", parsed.data.announcement],
      [
        "maintenance_mode",
        parsed.data.maintenance_mode === "on" ? "true" : "false",
      ],
    ] as const;
    for (const [key, value] of entries)
      await db
        .insert(siteSettings)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: { value, updatedAt: new Date() },
        });
    await audit(
      "site.content_updated",
      "Public recruitment content/settings updated",
      owner.id,
      requestIp(request),
    );
    return NextResponse.redirect(
      new URL("/admin/owner#site-settings", request.url),
      303,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "CSRF")
      return new NextResponse("Invalid request origin", { status: 403 });
    return NextResponse.redirect(
      new URL("/admin/owner?error=settings", request.url),
      303,
    );
  }
}
