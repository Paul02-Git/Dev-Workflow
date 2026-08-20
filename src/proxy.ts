import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, isValidSessionCookieValue } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const sessionValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (isValidSessionCookieValue(sessionValue)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Every route except the login page, the public client-facing handoff
    // pages (deliberately unauthenticated — gated by their own unguessable
    // token instead), static assets, and metadata files (icon/apple-icon
    // are served at extension-less routes like /icon?<hash>, so they need
    // an explicit exclusion — a plain extension-based pattern won't catch
    // them the way it does /logo.png or /favicon.ico).
    "/((?!login|handoff|_next/static|_next/image|icon|apple-icon|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp)$).*)",
  ],
};
