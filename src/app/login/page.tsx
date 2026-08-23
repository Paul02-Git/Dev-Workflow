import Image from "next/image";
import { loginAction } from "@/lib/auth-actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; minutes?: string }>;
}) {
  const { error, minutes } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="app-card w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <div className="mb-2 flex flex-col items-center">
          <Image src="/logo.png" alt="" width={80} height={80} loading="eager" className="shrink-0 rounded-md" />
          <div className="text-lg font-semibold leading-tight">
            DEV<span className="text-[#2a78d6]">OS</span>
          </div>
        </div>

        <form action={loginAction} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#52514e]">Password</label>
            <input
              type="password"
              name="password"
              required
              autoFocus
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          {error === "ratelimited" && (
            <p className="text-xs font-medium text-[#d03b3b]">
              Too many failed attempts. Try again in {minutes ?? "15"} minutes.
            </p>
          )}
          {error === "1" && (
            <p className="text-xs font-medium text-[#d03b3b]">Wrong password. Try again.</p>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
