import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cheap optimistic check only (cookie present). Real verification happens in requireUser().
export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has("sb_session");
  const { pathname } = req.nextUrl;
  const isPublic = pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/register");
  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
