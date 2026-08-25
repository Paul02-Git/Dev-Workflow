import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildGoogleAuthUrl } from "@/lib/google-oauth";

export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";

// intent=agency (default) logs into the org's dashboard; intent=client
// logs into /portal, matched against a client's contactEmail instead of
// an organization's linked email; intent=signup also auto-creates a new
// organization if no existing one matches the Google email (see
// callback/route.ts).
export async function GET(request: NextRequest) {
  const intentParam = request.nextUrl.searchParams.get("intent");
  const intent = intentParam === "client" ? "client" : intentParam === "signup" ? "signup" : "agency";

  const nonce = randomBytes(24).toString("hex");
  const redirectUri = new URL("/api/auth/google/callback", request.url).toString();
  const authUrl = buildGoogleAuthUrl(redirectUri, nonce);

  const response = NextResponse.redirect(authUrl);
  // Encodes intent alongside the nonce rather than a second cookie — one
  // round trip, and the callback needs both pieces of state together.
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, `${nonce}:${intent}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes — just long enough for the consent screen round trip
  });
  return response;
}
