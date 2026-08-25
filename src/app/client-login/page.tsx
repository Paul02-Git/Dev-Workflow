import {
  requestClientMagicLinkAction,
  requestClientMagicCodeAction,
  verifyClientMagicCodeAction,
} from "@/lib/actions";
import { AuthCard } from "@/components/auth-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; code?: string; email?: string }>;
}) {
  const { error, sent, code, email } = await searchParams;

  return (
    <AuthCard
      title="Client Workspace"
      subtitle="We'll email you a link to sign in — no password needed"
      googleHref="/api/auth/google/start?intent=client"
      footer="New here? Your agency will send you a link to get started."
    >
      {sent && code ? (
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-4 text-center text-sm">
            <p className="font-semibold">Check your email</p>
            <p className="mt-1 text-xs text-muted-foreground">We sent a 6-digit code. Enter it below to sign in.</p>
          </div>

          <form action={verifyClientMagicCodeAction} className="space-y-1.5">
            <Label htmlFor="code">Code</Label>
            <input type="hidden" name="email" value={email ?? ""} />
            <div className="flex gap-2">
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                required
                autoFocus
                className="text-center tracking-[0.3em]"
              />
              <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
                Verify
              </button>
            </div>
          </form>
          {error === "invalid_code" && (
            <p className="text-xs font-medium text-[#d03b3b]">That code is wrong or expired. Request a new one below.</p>
          )}
          {error === "rate_limited" && (
            <p className="text-xs font-medium text-[#d03b3b]">Too many attempts. Try again in a few minutes.</p>
          )}

          <a href="/client-login" className="block text-center text-xs text-muted-foreground hover:underline">
            Use a different email
          </a>
        </div>
      ) : sent ? (
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-4 text-center text-sm">
            <p className="font-semibold">Check your email</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Click the link to sign in. Works once, expires in 20 minutes.
            </p>
          </div>

          <form action={requestClientMagicCodeAction}>
            <input type="hidden" name="email" value={email ?? ""} />
            <button type="submit" className="block w-full text-center text-xs text-muted-foreground hover:underline">
              Opening this on another device? Email me a code instead
            </button>
          </form>

          <a href="/client-login" className="block text-center text-xs text-muted-foreground hover:underline">
            Use a different email
          </a>
        </div>
      ) : (
        <form action={requestClientMagicLinkAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" name="email" placeholder="you@yourcompany.com" required autoFocus autoCapitalize="off" autoCorrect="off" />
          </div>
          {error === "magic_expired" && (
            <p className="text-xs font-medium text-[#d03b3b]">That link expired or was already used. Request a new one below.</p>
          )}
          {error === "google_no_account" && (
            <p className="text-xs font-medium text-[#d03b3b]">
              No account is linked to that Google email yet. Try requesting a login link below instead, or contact your agency.
            </p>
          )}
          {error === "google_failed" && (
            <p className="text-xs font-medium text-[#d03b3b]">Google sign-in didn&apos;t go through. Please try again.</p>
          )}
          <button type="submit" className={cn(buttonVariants(), "w-full")}>
            Send me a login link
          </button>
        </form>
      )}
    </AuthCard>
  );
}
