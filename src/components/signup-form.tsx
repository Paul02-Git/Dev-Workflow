"use client";

import { signupAction } from "@/lib/auth-actions";
import { SubmitButton } from "@/components/submit-button";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Please fill in your email.",
  short_password: "Password must be at least 8 characters.",
  mismatch: "Passwords don't match.",
  email_taken: "That email is already linked to another organization.",
  google_failed: "Google sign-in didn't go through. Please try again.",
};

export function SignupForm({ error, defaultEmail }: { error?: string; defaultEmail?: string }) {
  return (
    <form action={signupAction} className="space-y-3">
      <div>
        <input
          type="email"
          name="email"
          required
          autoFocus
          defaultValue={defaultEmail}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="Email"
          aria-label="Email"
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">Lets you sign in with Google instead of your password later.</p>
      </div>
      <div>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          placeholder="Password"
          aria-label="Password"
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <input
          type="password"
          name="passwordConfirm"
          required
          minLength={8}
          placeholder="Confirm password"
          aria-label="Confirm password"
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-xs font-medium text-[#d03b3b]">{ERROR_MESSAGES[error] ?? "Something went wrong. Please try again."}</p>}
      <SubmitButton pendingLabel="Creating…" className="w-full rounded-md bg-[#111827] py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        Create my agency
      </SubmitButton>
    </form>
  );
}
