import Link from "next/link";
import { ShieldOffIcon, MailIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Platform-admin contact — the same person a deactivated org's account
// owner needs to reach to be restored. Not pulled from AGENCY_EMAIL
// (src/data/agency-info.ts), which is Dovera's own agency-facing contact
// for its clients, not the platform-admin contact for other organizations
// on this product.
const ADMIN_EMAIL = "paulpuzon0007@gmail.com";

/**
 * Reached three ways, all converging here rather than a generic error:
 * requireAuth() when a live session's org gets soft-deleted mid-session,
 * loginAction when correct email/password credentials belong to a
 * deactivated org, and the Google OAuth callback for the same case on
 * either the sign-in or sign-up path. Deliberately outside the (dashboard)
 * route group and excluded from proxy.ts's auth gate — same "public,
 * standalone" treatment as /login — since whoever lands here may not have
 * (or may be about to lose) a valid session.
 */
export default function AccountDeactivatedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="justify-items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-[#fdf5f5]">
            <ShieldOffIcon className="size-6 text-[#d03b3b]" strokeWidth={1.75} />
          </div>
          <CardTitle className="text-base">This account no longer has access</CardTitle>
          <CardDescription className="text-balance">
            This organization&apos;s access to DEVOS has been deactivated. If you believe this is a mistake, reach out to the
            platform admin and we&apos;ll help sort it out.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
            <MailIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <span className="truncate font-medium">{ADMIN_EMAIL}</span>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <a href={`mailto:${ADMIN_EMAIL}`} className={cn(buttonVariants(), "w-full gap-2")}>
            <MailIcon className="size-4" strokeWidth={1.75} />
            Email admin
          </a>
          <Link href="/login" className="text-center text-xs text-muted-foreground hover:underline">
            Back to login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
