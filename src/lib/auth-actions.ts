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
import { createOrganization, normalizeSlug } from "@/lib/queries/organizations";

export async function loginAction(formData: FormData) {
  const slug = String(formData.get("organization") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Resolved before rate-limiting/verification so both are scoped to the
  // right organization — an unknown slug still gets recorded (organizationId
  // null) so slug-guessing itself is rate-limited, just not attributable to
  // a real org's own lockout window.
  const [org] = slug
    ? await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug))
    : [];

  if (org) {
    // Checked before the password itself is even looked at — a locked-out
    // request shouldn't get a "wrong password" timing/behavior signal either.
    const rateLimit = await checkLoginRateLimit(org.id);
    if (!rateLimit.allowed) {
      redirect(`/login?error=ratelimited&minutes=${rateLimit.retryAfterMinutes}`);
    }
  }

  const verified = slug ? await verifyOrganizationPassword(slug, password) : null;
  await recordLoginAttempt(org?.id ?? null, !!verified);

  if (!verified) {
    redirect("/login?error=1");
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
 * which was migrated in directly. Starts completely empty (no clients/
 * projects), same shape any org would have right after this. Auto-logs
 * the new org in immediately, same as a successful loginAction, rather
 * than sending them to /login to type the password they just chose.
 */
export async function signupAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!name) redirect("/signup?error=invalid");

  const slug = normalizeSlug(slugInput);
  if (!slug) redirect("/signup?error=invalid");
  if (password.length < 8) redirect("/signup?error=short_password");
  if (password !== passwordConfirm) redirect("/signup?error=mismatch");

  let org;
  try {
    org = await createOrganization({ name, slug, password });
  } catch {
    redirect(`/signup?error=slug_taken&name=${encodeURIComponent(name)}`);
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
