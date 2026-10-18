import { randomUUID } from "node:crypto";
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
export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await currentUser();
    if (!user)
      return NextResponse.redirect(new URL("/login", request.url), 303);
    if (!hasPermission(user, "positions.manage"))
      return new NextResponse("Forbidden", { status: 403 });
    const f = await request.formData();
    const parsed = positionSchema.safeParse({
      title: f.get("title"),
      description: f.get("description"),
      requirements: f.get("requirements") || "",
      deadline: f.get("deadline") || "",
    });
    if (!parsed.success)
      return NextResponse.redirect(
        new URL("/admin/owner?error=position", request.url),
        303,
      );
    const schema = makePositionQuestions(f);
    const id = randomUUID();
    await db.insert(positions).values({
      id,
      ...parsed.data,
      deadline: parsed.data.deadline ?? null,
      formSchema: schema,
    });
    await audit(
      "position.created",
      parsed.data.title,
      user.id,
      requestIp(request),
    );
    return NextResponse.redirect(
      new URL(
        user.role === "SUPER_OWNER"
          ? "/admin/owner#positions"
          : "/admin#new-position",
        request.url,
      ),
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
