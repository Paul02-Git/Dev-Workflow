import { clientLoginAction } from "@/lib/actions";

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="app-card w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <div className="mb-2 flex flex-col items-center">
          <div className="text-lg font-semibold leading-tight">
            DEV<span className="text-primary">OS</span>
          </div>
          <div className="text-xs text-muted-foreground">Client workspace</div>
        </div>

        <form action={clientLoginAction} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#52514e]">Username</label>
            <input
              type="text"
              name="loginSlug"
              required
              autoFocus
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#52514e]">Password</label>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          {error === "rate_limited" && (
            <p className="text-xs font-medium text-[#d03b3b]">Too many failed attempts. Try again in 15 minutes.</p>
          )}
          {error === "invalid" && (
            <p className="text-xs font-medium text-[#d03b3b]">Wrong username or password. Try again.</p>
          )}
          {error === "invalid_invite" && (
            <p className="text-xs font-medium text-[#d03b3b]">That setup link is no longer valid. Ask Paul to send a new one.</p>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Sign in
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Don&apos;t have an account yet? Paul will send you a setup link.
        </p>
      </div>
    </div>
  );
}
