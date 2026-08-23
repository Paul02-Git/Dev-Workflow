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
    // Every route except the login page, the new-organization signup page
    // (both deliberately unauthenticated — you can't have a session before
    // you have an account), the public client-facing handoff/portal/intake
    // pages (deliberately unauthenticated — gated by their own unguessable
    // tokens instead), the portal's own polling API route (api/portal/... —
    // same public/token-gated reasoning, needs its own entry since it
    // doesn't start with "portal"), static assets, and metadata files
    // (icon/apple-icon are served at extension-less routes like
    // /icon?<hash>, so they need an explicit exclusion — a plain
    // extension-based pattern won't catch them the way it does /logo.png
    // or /favicon.ico).
    "/((?!login|signup|handoff|portal|intake|api/portal|_next/static|_next/image|icon|apple-icon|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp)$).*)",
  ],
};
