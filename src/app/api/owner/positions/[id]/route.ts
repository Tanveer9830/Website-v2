import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { positions } from "@/lib/schema";
import {
  audit,
  currentUser,
  hasPermission,
  requestIp,
  verifySameOrigin,
} from "@/lib/security";
import { positionSchema } from "@/lib/validation";
import { makePositionQuestions } from "@/lib/positions";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Ctx) {
  try {
    verifySameOrigin(request);
    const user = await currentUser();
    if (!user)
      return NextResponse.redirect(new URL("/login", request.url), 303);
    if (!hasPermission(user, "positions.manage"))
      return new NextResponse("Forbidden", { status: 403 });
    const { id } = await params;
    const [position] = await db
      .select()
      .from(positions)
      .where(eq(positions.id, id))
      .limit(1);
    if (!position) return new NextResponse("Not found", { status: 404 });
    const form = await request.formData();
    if (form.get("action") === "toggle") {
      await db
        .update(positions)
        .set({ isOpen: !position.isOpen, updatedAt: new Date() })
        .where(eq(positions.id, id));
      await audit(
        "position.toggled",
        `${position.title}: open=${!position.isOpen}`,
        user.id,
        requestIp(request),
      );
    } else {
      const parsed = positionSchema.safeParse({
        title: form.get("title"),
        description: form.get("description"),
        requirements: form.get("requirements") || "",
        deadline: form.get("deadline") || "",
      });
      if (!parsed.success)
        return NextResponse.redirect(
          new URL("/admin/owner?error=position", request.url),
          303,
        );
      const update = {
        ...parsed.data,
        deadline: parsed.data.deadline ?? null,
        updatedAt: new Date(),
        ...(form.get("update_form_schema") === "on"
          ? { formSchema: makePositionQuestions(form) }
          : {}),
      };
      await db.update(positions).set(update).where(eq(positions.id, id));
      await audit(
        "position.updated",
        `Position ${id} updated; existing applications retain their saved form snapshot.`,
        user.id,
        requestIp(request),
      );
    }
    return NextResponse.redirect(
      new URL("/admin/owner#positions", request.url),
      303,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "CSRF")
      return new NextResponse("Invalid request origin", { status: 403 });
    return NextResponse.redirect(
      new URL("/admin/owner?error=position", request.url),
      303,
    );
  }
}
