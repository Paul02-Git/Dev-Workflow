import { cache } from "react";
import { createHmac, timingSafeEqual, randomBytes, scryptSync } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { loginAttempts, organizations } from "@/db/schema";
import { AGENCY_EMAIL } from "@/data/agency-info";
import { withTimeout } from "@/lib/with-timeout";

export const SESSION_COOKIE_NAME = "workflow_os_session";
const SESSION_VERSION = "v2"; // v1 was the pre-multi-tenant single-shared-password cookie.

// Deliberately a different cookie name and payload prefix from the agency
// session above, not just a different value under the same name — proxy.ts
// only ever checks SESSION_COOKIE_NAME for internal-dashboard routes, so a
// client session must be structurally impossible to mistake for (or
// upgrade into) an agency session, even if a route's exclusion list were
// ever misconfigured.
export const CLIENT_SESSION_COOKIE_NAME = "workflow_os_client_session";
const CLIENT_SESSION_VERSION = "c1";

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 5;

// scrypt params — deliberately using Node's built-in crypto (same pattern
// as src/lib/crypto.ts's AES-GCM vault) rather than adding a bcrypt/argon2
// dependency. Pinned explicitly (matching Node's own current default)
// rather than left implicit — if a future Node version ever changes its
// default cost factor, an implicit default would silently break
// verification of hashes created under the old default, since
// verifyPasswordHash re-derives with whatever the "default" is *at verify
// time*, not at hash time.
const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

/** Format: base64(salt[16]).hash(hex) — salt stored alongside the hash, not secret itself. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N });
  return `${salt.toString("base64")}.${hash.toString("hex")}`;
}

/** Constant-time comparison against a stored scrypt hash — avoids leaking password length/content via timing. */
export function verifyPasswordHash(password: string, stored: string): boolean {
  const [saltB64, hashHex] = stored.split(".");
  if (!saltB64 || !hashHex) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Looks up an organization by email and verifies the password against its
 * stored hash. Returns null on any failure (unknown email or wrong
 * password) — deliberately not distinguishing which, same reasoning as
 * the old single-password flow. Deliberately does NOT filter out
 * soft-deleted orgs the way most other lookups in this codebase do: the
 * caller (loginAction) needs to tell "wrong credentials" apart from
 * "correct credentials, but this account was deactivated" so it can send
 * a deactivated org to a clear explanation instead of a generic wrong-
 * password error — proving you know the password is proof of ownership,
 * so it's safe to reveal deactivation status at that point. `deletedAt` on
 * the returned object is what the caller branches on.
 */
export async function verifyOrganizationPassword(
  email: string,
  password: string
): Promise<{ id: string; name: string; deletedAt: Date | null } | null> {
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, passwordHash: organizations.passwordHash, deletedAt: organizations.deletedAt })
    .from(organizations)
    .where(eq(organizations.email, email.trim().toLowerCase()));
  if (!org) return null;
  if (!verifyPasswordHash(password, org.passwordHash)) return null;
  return { id: org.id, name: org.name, deletedAt: org.deletedAt };
}

export function makeSessionCookieValue(organizationId: string): string {
  const payload = `${SESSION_VERSION}:${organizationId}`;
  return `${payload}.${sign(payload)}`;
}

/** Parses and verifies a session cookie value, returning the organizationId it was issued for, or null if missing/invalid/tampered. */
export function parseSessionCookieValue(value: string | undefined): { organizationId: string } | null {
  if (!value) return null;
  const lastDot = value.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);
  const [version, organizationId] = payload.split(":");
  if (version !== SESSION_VERSION || !organizationId) return null;

  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  return { organizationId };
}

/**
 * DB-backed, not in-memory — an in-memory counter would silently reset on
 * every cold start if this ever runs on a serverless platform (Vercel),
 * which would quietly defeat the whole point. Scoped per organization now
 * (previously a single global window): a brute-force attempt against one
 * agency's password must not lock out every other agency using the app.
 */
export async function checkLoginRateLimit(
  organizationId: string
): Promise<{ allowed: boolean; retryAfterMinutes: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.organizationId, organizationId),
        eq(loginAttempts.success, false),
        gte(loginAttempts.createdAt, windowStart)
      )
    );

  const failureCount = Number(row?.count ?? 0);
  if (failureCount >= RATE_LIMIT_MAX_FAILURES) {
    return { allowed: false, retryAfterMinutes: RATE_LIMIT_WINDOW_MINUTES };
  }
  return { allowed: true, retryAfterMinutes: 0 };
}

/** organizationId is null when the attempted slug doesn't match any real organization — still recorded so a slug-guessing attack is rate-limited too, just not attributable to a real org's own lockout window. */
export async function recordLoginAttempt(organizationId: string | null, success: boolean): Promise<void> {
  await db.insert(loginAttempts).values({ organizationId, success });
  // Opportunistic cleanup so this table doesn't grow forever — nothing
  // outside the rate-limit window is ever read again.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, cutoff));
}

/**
 * Resolves the display name to attribute an authenticated agency action to
 * (activity-log "who did this," the internal Messages tab's author name,
 * the dashboard greeting) — the organization's own name, which for a
 * Google-signup account is that real person's name (see
 * createOrganizationFromGoogle in queries/organizations.ts), not a
 * hardcoded single-tenant constant. Falls back to "Agency" only if the org
 * row is somehow gone by the time this runs (shouldn't happen for anything
 * gated by requireAuth first).
 */
// Single shared row lookup backing requireAuth()/getOrganizationActorName()/
// getOrganizationContactEmail() below — cache()-wrapped so calling all three
// in one request (the dashboard layout does exactly this) costs one query
// total instead of three, each independently deduped against its own
// repeats but not against each other. Selects every column any of the three
// callers need, so there's exactly one source of truth for this row per
// request rather than N differently-shaped queries against it.
const getOrganizationCore = cache(async (organizationId: string) => {
  const [org] = await db
    .select({
      id: organizations.id,
      deletedAt: organizations.deletedAt,
      name: organizations.name,
      email: organizations.email,
      isPlatformAdmin: organizations.isPlatformAdmin,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  return org ?? null;
});

export const getOrganizationActorName = cache(async (organizationId: string): Promise<string> => {
  const org = await getOrganizationCore(organizationId);
  return org?.name ?? "Agency";
});

/** Resolves which email to tell a client to invite (access-item preset instructions — see resolvePresetInstructions in data/access-item-presets.ts). Falls back to AGENCY_EMAIL only for the unexpected case of an org with no email on file — signup requires one, so this should be rare in practice. */
export const getOrganizationContactEmail = cache(async (organizationId: string): Promise<string> => {
  const org = await getOrganizationCore(organizationId);
  return org?.email ?? AGENCY_EMAIL;
});

/**
 * Cheap check for whether to show the Admin nav link at all — the actual
 * security boundary is requirePlatformAdmin() in queries/organizations.ts,
 * called again by every /admin page/action; this is just for the sidebar's
 * own conditional rendering, so it's safe to read off the same cached row
 * requireAuth()/getOrganizationActorName() already fetched for this
 * request, instead of the separate query this used to run (previously
 * `isPlatformAdminOrg` in queries/organizations.ts) — the dashboard layout
 * runs on every single page in the app, so that was one extra DB round trip
 * on every navigation.
 */
export const getOrganizationIsPlatformAdmin = cache(async (organizationId: string): Promise<boolean> => {
  const org = await getOrganizationCore(organizationId);
  return !!org?.isPlatformAdmin;
});

/**
 * Defense-in-depth for sensitive server actions (the password vault reveal
 * action in particular). Proxy already gates every page route, but Next's
 * own docs warn that a matcher change or route refactor can silently drop
 * Proxy coverage for a Server Function — so the most sensitive actions
 * re-check the session themselves rather than trusting Proxy alone.
 * Returns the caller's organizationId — every query this powers must be
 * scoped to it.
 *
 * The DB check is timeout-protected (see withTimeout/resetDbConnection) —
 * this runs on literally every dashboard page load via the layout, ahead
 * of everything else, so a single stuck pooled connection here (this
 * project's Supabase pooler has hit this failure mode more than once —
 * see with-timeout.ts) would otherwise hang every page in the app until
 * Postgres's own statement_timeout eventually kills it, with no pool reset
 * in between to let the next request recover. This still throws on
 * timeout, same as any other auth failure — a stuck connection must never
 * be treated as "authenticated" — it just fails fast and clears the
 * poisoned pool instead of hanging.
 *
 * Also handles an org being deleted out from under an already-logged-in
 * session (the soft-delete blocks login going forward, but doesn't touch
 * any session cookie already issued) — redirects to /account-deactivated
 * instead of the bare "Not authenticated" throw a missing/invalid cookie
 * gets, since that's a materially different, more helpful outcome for
 * someone who still has a live session for a now-deactivated org.
 */
/**
 * The organizationId from the session cookie alone — signature-verified,
 * but with no DB round trip, since that's pure HMAC verification against
 * an in-request cookie read. Split out of requireAuth() so a caller that
 * needs the id to kick off its own org-scoped queries doesn't have to wait
 * for requireAuth()'s DB existence/deactivation check to finish first — see
 * requireAuth()'s own comment for why that ordering used to cost a real,
 * measured extra round trip on every single page load in the app.
 */
export async function getSessionOrganizationId(): Promise<string> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(value);
  if (!session) throw new Error("Not authenticated");
  return session.organizationId;
}

// Wrapped in React's cache() — every page under (dashboard) calls this
// again on top of the shared layout already calling it once per request,
// which was previously two round-trips to the same organizations row for
// every single navigation. cache() only dedupes within one request's
// render, never persists across requests, so a fresh request always runs
// the real DB check (and redirect/throw) at least once — this can never
// serve a stale or bypassed auth result.
//
// Takes no arguments, so cache() shares one single in-flight/resolved
// result across every call in a request regardless of when each caller
// invokes it — which is what makes it safe for a caller (the dashboard
// layout) to fire this concurrently alongside other org-scoped queries
// that already have organizationId from getSessionOrganizationId() above,
// instead of blocking on this resolving first: if this rejects or
// redirects, whatever Promise.all it's grouped into rejects/redirects the
// same way, and nothing from the other now-pointless queries is ever
// rendered or sent — the only cost of firing them early is a few wasted
// SELECTs in the rare case the org was deactivated mid-session, never a
// security exposure, since organizationId itself was already
// signature-verified before either request starts.
export const requireAuth = cache(async (): Promise<{ organizationId: string }> => {
  const organizationId = await getSessionOrganizationId();
  const org = await withTimeout(getOrganizationCore(organizationId), 5000, "requireAuth");
  if (!org) throw new Error("Not authenticated");
  if (org.deletedAt) redirect("/account-deactivated");

  return { organizationId };
});

// ---------------------------------------------------------------------------
// Client Workspace auth — a real login (loginSlug + password) replacing the
// old bearer-token-in-the-URL model. Mirrors the organization auth above
// (same scrypt hashing, same HMAC-signed-cookie shape, same DB-backed rate
// limiting) but is kept as its own parallel set of functions rather than a
// shared abstraction: there are exactly two call sites (agency login,
// client login), and forcing them through one generic "principal" concept
// would obscure the one thing that must never blur — a client session must
// never be usable as, or confusable with, an agency session.
// ---------------------------------------------------------------------------

export function makeClientSessionCookieValue(clientId: string): string {
  const payload = `${CLIENT_SESSION_VERSION}:${clientId}`;
  return `${payload}.${sign(payload)}`;
}

export function parseClientSessionCookieValue(value: string | undefined): { clientId: string } | null {
  if (!value) return null;
  const lastDot = value.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);
  const [version, clientId] = payload.split(":");
  if (version !== CLIENT_SESSION_VERSION || !clientId) return null;

  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  return { clientId };
}

/** Same reasoning and mechanism as checkLoginRateLimit, scoped per client instead of per organization. */
export async function checkClientLoginRateLimit(clientId: string): Promise<{ allowed: boolean; retryAfterMinutes: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.clientId, clientId),
        eq(loginAttempts.success, false),
        gte(loginAttempts.createdAt, windowStart)
      )
    );

  const failureCount = Number(row?.count ?? 0);
  if (failureCount >= RATE_LIMIT_MAX_FAILURES) {
    return { allowed: false, retryAfterMinutes: RATE_LIMIT_WINDOW_MINUTES };
  }
  return { allowed: true, retryAfterMinutes: 0 };
}

export async function recordClientLoginAttempt(clientId: string | null, success: boolean): Promise<void> {
  await db.insert(loginAttempts).values({ clientId, success });
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.delete(loginAttempts).where(lt(loginAttempts.createdAt, cutoff));
}

/** Same defense-in-depth reasoning as requireAuth, for client-facing Server Actions. Returns the caller's clientId — every query/action this powers must be scoped to it (and re-verify project ownership, since a clientId alone doesn't imply which projects it owns). */
export async function requireClientAuth(): Promise<{ clientId: string }> {
  const store = await cookies();
  const value = store.get(CLIENT_SESSION_COOKIE_NAME)?.value;
  const session = parseClientSessionCookieValue(value);
  if (!session) {
    throw new Error("Not authenticated");
  }
  return session;
}
