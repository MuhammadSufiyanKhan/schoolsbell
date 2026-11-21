import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cheap optimistic check only (cookie present). Real verification happens in requireUser().
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has("sb_session");
  const { pathname } = req.nextUrl;
  const isPublic = pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/register");
  if (!hasSession && !isPublic) {
    // Pages send people to the login screen; API calls get a real 401 (a followed redirect would hand the login
    // page's HTML to code that expected JSON or streamed text).
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
