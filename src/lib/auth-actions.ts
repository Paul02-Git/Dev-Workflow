"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  verifyOrganizationPassword,
  makeSessionCookieValue,
  SESSION_COOKIE_NAME,
  checkLoginRateLimit,
  recordLoginAttempt,
} from "@/lib/auth";
import { createOrganizationFromEmail } from "@/lib/queries/organizations";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Resolved before rate-limiting/verification so both are scoped to the
  // right organization — an unknown email still gets recorded (organizationId
  // null) so email-guessing itself is rate-limited, just not attributable to
  // a real org's own lockout window.
  const [org] = email
    ? await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.email, email))
    : [];

  if (org) {
    // Checked before the password itself is even looked at — a locked-out
    // request shouldn't get a "wrong password" timing/behavior signal either.
    const rateLimit = await checkLoginRateLimit(org.id);
    if (!rateLimit.allowed) {
      redirect(`/login?error=ratelimited&minutes=${rateLimit.retryAfterMinutes}`);
    }
  }

  const verified = email ? await verifyOrganizationPassword(email, password) : null;
  await recordLoginAttempt(org?.id ?? null, !!verified);

  if (!verified) {
    redirect("/login?error=1");
  }

  // Correct credentials for a deactivated org — proving you know the
  // password is proof of ownership, so it's safe (and much more helpful
  // than a generic "wrong password") to send them straight to the
  // deactivated-account explanation instead of logging them in.
  if (verified.deletedAt) {
    redirect("/account-deactivated");
  }

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, makeSessionCookieValue(verified.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect("/dashboard");
}

/**
 * Onboards a brand-new organization (agency) — everyone except Dovera,
 * which was migrated in directly. Just email + password: no separate
 * agency-name field, matching login's own email-based identity (the org's
 * display name/slug are auto-derived from the email — see
 * createOrganizationFromEmail — and can be renamed later; nothing here
 * requires the user to type or pick one up front). Starts completely
 * empty (no clients/projects), same shape any org would have right after
 * this. Auto-logs the new org in immediately, same as a successful
 * loginAction, rather than sending them to /login to type the password
 * they just chose.
 */
export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  const back = (error: string) => redirect(`/signup?error=${error}&email=${encodeURIComponent(email)}`);

  if (!email) back("invalid");
  if (password.length < 8) back("short_password");
  if (password !== passwordConfirm) back("mismatch");

  let org;
  try {
    org = await createOrganizationFromEmail({ email, password });
  } catch (err) {
    if (err instanceof Error && err.message === "email_taken") back(err.message);
    throw err; // unexpected — don't lie and call it an email conflict
  }

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, makeSessionCookieValue(org.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
