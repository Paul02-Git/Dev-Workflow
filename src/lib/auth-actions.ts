"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  verifyPassword,
  makeSessionCookieValue,
  SESSION_COOKIE_NAME,
  checkLoginRateLimit,
  recordLoginAttempt,
} from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  // Checked before the password itself is even looked at — a locked-out
  // request shouldn't get a "wrong password" timing/behavior signal either.
  const rateLimit = await checkLoginRateLimit();
  if (!rateLimit.allowed) {
    redirect(`/login?error=ratelimited&minutes=${rateLimit.retryAfterMinutes}`);
  }

  const valid = verifyPassword(password);
  await recordLoginAttempt(valid);

  if (!valid) {
    redirect("/login?error=1");
  }

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, makeSessionCookieValue(), {
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
