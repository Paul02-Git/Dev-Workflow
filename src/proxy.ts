import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, parseSessionCookieValue } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const sessionValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (parseSessionCookieValue(sessionValue)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Every route except: the agency login/signup pages (deliberately
    // unauthenticated — you can't have a session before you have an
    // account); the client-facing login/invite/handoff/portal/intake pages
    // (never require an AGENCY session — /portal itself is gated by its
    // own client session, checked directly in that page via
    // requireClientAuth(), the same "page checks its own auth" pattern
    // this proxy plays for agency pages, just for a different session
    // type this proxy never inspects); the portal's own polling API route
    // (api/portal/... — same reasoning, needs its own entry since it
    // doesn't start with "portal"); static assets; and metadata files
    // (icon/apple-icon are served at extension-less routes like
    // /icon?<hash>, so they need an explicit exclusion — a plain
    // extension-based pattern won't catch them the way it does /logo.png
    // or /favicon.ico).
    "/((?!login|signup|client-login|client-invite|handoff|portal|intake|api/portal|_next/static|_next/image|icon|apple-icon|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp)$).*)",
  ],
};
