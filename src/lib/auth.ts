import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { loginAttempts } from "@/db/schema";

export const SESSION_COOKIE_NAME = "workflow_os_session";
const SESSION_VALUE = "authenticated:v1";

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 5;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

/** Constant-time comparison — avoids leaking password length/content via timing. */
export function verifyPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD is not set");

  const inputBuf = Buffer.from(input);
  const expectedBuf = Buffer.from(expected);
  if (inputBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(inputBuf, expectedBuf);
}

export function makeSessionCookieValue(): string {
  return `${SESSION_VALUE}.${sign(SESSION_VALUE)}`;
}

export function isValidSessionCookieValue(value: string | undefined): boolean {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || payload !== SESSION_VALUE) return false;

  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(sigBuf, expectedBuf);
}

/**
 * DB-backed, not in-memory — an in-memory counter would silently reset on
 * every cold start if this ever runs on a serverless platform (Vercel),
 * which would quietly defeat the whole point. A global sliding window
 * (not per-IP) is deliberate: this is a single-shared-password app, so
 * per-IP tracking adds complexity (spoofable headers, proxies) without a
 * real benefit — one legitimate user, one lockout clock.
 */
export async function checkLoginRateLimit(): Promise<{ allowed: boolean; retryAfterMinutes: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.success, false), gte(loginAttempts.createdAt, windowStart)));

  const failureCount = Number(row?.count ?? 0);
  if (failureCount >= RATE_LIMIT_MAX_FAILURES) {
    return { allowed: false, retryAfterMinutes: RATE_LIMIT_WINDOW_MINUTES };
  }
  return { allowed: true, retryAfterMinutes: 0 };
}

export async function recordLoginAttempt(success: boolean): Promise<void> {
  await db.insert(loginAttempts).values({ success });
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
 */
export async function requireAuth(): Promise<void> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  if (!isValidSessionCookieValue(value)) {
    throw new Error("Not authenticated");
  }
}
