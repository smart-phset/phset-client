import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verify } from "@/lib/auth";

// Onboarding gate: no session -> the sign-in screen (or 401 for API calls).
export async function proxy(req: NextRequest) {
  if (await verify(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ error: "unauthorized", message: "Sign in or continue as a guest first." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  const next = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/signin";
  url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the sign-in page, its API, Next.js internals and public files.
  matcher: ["/((?!signin|api/auth/|api/healthz$|_next/|brand/|mock/|photos/|stitch/|fonts/|favicon|robots).*)"],
};
