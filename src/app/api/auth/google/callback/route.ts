import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeGoogleCode, fetchGoogleUserInfo } from "@/lib/google-oauth";
import { getOrganizationByEmailIncludingDeleted, createOrganizationFromGoogle } from "@/lib/queries/organizations";
import { getClientByContactEmail } from "@/lib/queries/clients";
import {
  SESSION_COOKIE_NAME,
  makeSessionCookieValue,
  CLIENT_SESSION_COOKIE_NAME,
  makeClientSessionCookieValue,
} from "@/lib/auth";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/app/api/auth/google/start/route";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days — matches loginAction/requestClientMagicLinkAction's own session lifetime

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");

  const store = await cookies();
  const stateCookie = store.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  store.delete(GOOGLE_OAUTH_STATE_COOKIE);

  const [nonce, intent] = (stateCookie ?? "").split(":");
  const isClientIntent = intent === "client";
  const isSignupIntent = intent === "signup";
  const failUrl = isClientIntent ? "/client-login?error=google_failed" : isSignupIntent ? "/signup?error=google_failed" : "/login?error=google_failed";
  const noAccountUrl = isClientIntent ? "/client-login?error=google_no_account" : "/login?error=google_no_account";

  const stateValid =
    !!code && !!returnedState && !!nonce && returnedState === nonce && (intent === "agency" || intent === "client" || intent === "signup");
  if (!stateValid) {
    return NextResponse.redirect(new URL(failUrl, request.url));
  }

  try {
    const redirectUri = new URL("/api/auth/google/callback", request.url).toString();
    const { accessToken } = await exchangeGoogleCode(code!, redirectUri);
    const profile = await fetchGoogleUserInfo(accessToken);

    if (!profile.emailVerified || !profile.email) {
      return NextResponse.redirect(new URL(isSignupIntent ? failUrl : noAccountUrl, request.url));
    }

    if (isClientIntent) {
      const client = await getClientByContactEmail(profile.email);
      if (!client) return NextResponse.redirect(new URL(noAccountUrl, request.url));

      const response = NextResponse.redirect(new URL("/portal", request.url));
      response.cookies.set(CLIENT_SESSION_COOKIE_NAME, makeClientSessionCookieValue(client.id), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      });
      return response;
    }

    if (isSignupIntent) {
      const existing = await getOrganizationByEmailIncludingDeleted(profile.email);
      // A deactivated org trying to "sign up" with the same email would
      // otherwise hit createOrganizationFromGoogle's own email_taken guard
      // and land on a generic "Google sign-in didn't go through" — this is
      // the actually-informative outcome for that case.
      if (existing?.deletedAt) return NextResponse.redirect(new URL("/account-deactivated", request.url));

      // Signing up with an email already linked to an org just logs them
      // in instead of failing — the same "already have an account" outcome
      // GitHub/Google's own OAuth-signup flows give.
      const org = existing ?? (await createOrganizationFromGoogle({ name: profile.name || profile.email.split("@")[0], email: profile.email }));

      const response = NextResponse.redirect(new URL("/dashboard", request.url));
      response.cookies.set(SESSION_COOKIE_NAME, makeSessionCookieValue(org.id), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      });
      return response;
    }

    const org = await getOrganizationByEmailIncludingDeleted(profile.email);
    if (org?.deletedAt) return NextResponse.redirect(new URL("/account-deactivated", request.url));
    if (!org) return NextResponse.redirect(new URL(noAccountUrl, request.url));

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set(SESSION_COOKIE_NAME, makeSessionCookieValue(org.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch {
    // Google unreachable, token exchange rejected, malformed response, etc.
    // — same fail-closed redirect as an unmatched account, no internal
    // detail leaked to the URL. Signup gets its own "try again" message
    // rather than the login/client "no account" copy, which wouldn't fit.
    return NextResponse.redirect(new URL(isSignupIntent ? failUrl : noAccountUrl, request.url));
  }
}
