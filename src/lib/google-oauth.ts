// Hand-rolled Google OAuth 2.0 Authorization Code flow — no dependency
// (fetch + built-in crypto, same "no library for what a few functions can
// do" pattern as the rest of this app's auth). Route handlers in
// src/app/api/auth/google/{start,callback} own the cookie/session
// plumbing; these are the pure network calls.

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function getGoogleClientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id) throw new Error("GOOGLE_CLIENT_ID is not set");
  return id;
}

function getGoogleClientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("GOOGLE_CLIENT_SECRET is not set");
  return secret;
}

/** Builds the URL to send the browser to for Google's consent screen. `state` is the CSRF nonce, verified against a signed cookie when the callback returns. */
export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/** Server-side code-for-token exchange — client_secret never reaches the browser. */
export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<{ accessToken: string }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google token exchange returned no access_token");
  return { accessToken: data.access_token };
}

/** email_verified must be checked by the caller before trusting `email` for account matching. */
export async function fetchGoogleUserInfo(
  accessToken: string
): Promise<{ email: string; emailVerified: boolean; name: string | null }> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo fetch failed: ${res.status}`);
  const data = (await res.json()) as { email?: string; email_verified?: boolean; name?: string };
  return {
    email: (data.email ?? "").trim().toLowerCase(),
    emailVerified: data.email_verified === true,
    name: typeof data.name === "string" ? data.name : null,
  };
}
