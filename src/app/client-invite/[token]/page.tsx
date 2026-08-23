import { notFound } from "next/navigation";
import { getClientByInviteToken } from "@/lib/queries/clients";
import { setClientPasswordAction } from "@/lib/actions";

const ERROR_MESSAGES: Record<string, string> = {
  short_password: "Password must be at least 8 characters.",
  mismatch: "Passwords don't match.",
};

export default async function ClientInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const client = await getClientByInviteToken(token);
  if (!client) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="app-card w-full max-w-sm rounded-xl border border-border bg-card p-6">
        <div className="mb-2 flex flex-col items-center">
          <div className="text-lg font-semibold leading-tight">
            DEV<span className="text-primary">OS</span>
          </div>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Welcome, {client.name.split(" ")[0]} — set a password to access your workspace.
          </p>
        </div>

        <form action={setClientPasswordAction} className="space-y-3">
          <input type="hidden" name="inviteToken" value={token} />
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#52514e]">Password</label>
            <input
              type="password"
              name="password"
              required
              autoFocus
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
            Set password and continue
          </button>
        </form>
      </div>
    </div>
  );
}
