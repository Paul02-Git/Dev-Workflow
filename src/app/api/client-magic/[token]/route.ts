import { NextResponse, type NextRequest } from "next/server";
import { verifyClientMagicLink } from "@/lib/queries/clients";
import { CLIENT_SESSION_COOKIE_NAME, makeClientSessionCookieValue } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await verifyClientMagicLink(token);

  if (!client) {
    return NextResponse.redirect(new URL("/client-login?error=magic_expired", request.url));
  }

  const response = NextResponse.redirect(new URL("/portal", request.url));
  response.cookies.set(CLIENT_SESSION_COOKIE_NAME, makeClientSessionCookieValue(client.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days — matches the agency session's own lifetime
  });
  return response;
}
