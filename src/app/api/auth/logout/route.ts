import { NextResponse } from "next/server";
import {
  audit,
  currentUser,
  endSession,
  requestIp,
  verifySameOrigin,
} from "@/lib/security";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    verifySameOrigin(request);
    const user = await currentUser();
    if (user)
      await audit("auth.logout", "Signed out", user.id, requestIp(request));
    await endSession();
    return NextResponse.redirect(new URL("/", request.url), 303);
  } catch {
    return NextResponse.redirect(new URL("/?error=csrf", request.url), 303);
  }
}
