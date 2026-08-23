import { createHmac, timingSafeEqual, randomBytes, scryptSync } from "crypto";
import { cookies } from "next/headers";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { loginAttempts, organizations } from "@/db/schema";

export const SESSION_COOKIE_NAME = "workflow_os_session";
const SESSION_VERSION = "v2"; // v1 was the pre-multi-tenant single-shared-password cookie.

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

/** Looks up an organization by slug and verifies the password against its stored hash. Returns the org's id/name on success, null on any failure (unknown slug or wrong password) — deliberately not distinguishing which, same reasoning as the old single-password flow. */
export async function verifyOrganizationPassword(
  slug: string,
  password: string
): Promise<{ id: string; name: string } | null> {
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, passwordHash: organizations.passwordHash })
    .from(organizations)
    .where(eq(organizations.slug, slug));
  if (!org) return null;
  if (!verifyPasswordHash(password, org.passwordHash)) return null;
  return { id: org.id, name: org.name };
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
 * Defense-in-depth for sensitive server actions (the password vault reveal
 * action in particular). Proxy already gates every page route, but Next's
 * own docs warn that a matcher change or route refactor can silently drop
 * Proxy coverage for a Server Function — so the most sensitive actions
 * re-check the session themselves rather than trusting Proxy alone.
 * Returns the caller's organizationId — every query this powers must be
 * scoped to it.
 */
export async function requireAuth(): Promise<{ organizationId: string }> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(value);
  if (!session) {
    throw new Error("Not authenticated");
  }
  return session;
}
