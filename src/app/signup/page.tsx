import Image from "next/image";
import Link from "next/link";
import { signupAction } from "@/lib/auth-actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Please fill in your agency name and choose a URL.",
  short_password: "Password must be at least 8 characters.",
  mismatch: "Passwords don't match.",
  slug_taken: "That organization URL is already taken — try another.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; name?: string }>;
}) {
  const { error, name } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="app-card w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <div className="mb-2 flex flex-col items-center">
          <Image src="/logo.png" alt="" width={80} height={80} loading="eager" className="shrink-0 rounded-md" />
          <div className="text-lg font-semibold leading-tight">
            DEV<span className="text-[#2a78d6]">OS</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Set up your agency</p>
        </div>

        <form action={signupAction} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#52514e]">Agency name</label>
            <input
              type="text"
              name="name"
              required
              autoFocus
              defaultValue={name}
              placeholder="Northgate Digital"
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#52514e]">Organization URL</label>
            <input
              type="text"
              name="slug"
              required
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="northgate-digital"
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              What you and your team will type to sign in — lowercase letters, numbers, and hyphens only.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#52514e]">Password</label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#52514e]">Confirm password</label>
            <input
              type="password"
              name="passwordConfirm"
              required
              minLength={8}
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <p className="text-xs font-medium text-[#d03b3b]">
              {ERROR_MESSAGES[error] ?? "Something went wrong. Please try again."}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Create my agency
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
