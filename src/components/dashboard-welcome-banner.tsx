import Link from "next/link";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Replaces the plain "Dashboard" title/subtitle with a hero banner —
 * on-brand (the app's own primary/primary-hover gradient, not the
 * reference mockup's purple) rather than a literal color copy, and the
 * stat is real: the same action-queue count already computed on this
 * page, not an invented "16 new applications." "Review it" jumps down to
 * the Action Queue card (#action-queue) already on this page instead of
 * linking somewhere new.
 */
export function DashboardWelcomeBanner({
  ownerName,
  actionQueueCount,
}: {
  ownerName: string;
  actionQueueCount: number;
}) {
  return (
    <div className="relative h-full rounded-2xl bg-gradient-to-br from-primary to-primary-hover px-6 py-7 sm:px-8">
      <div className="relative z-10 max-w-sm">
        <h1 className="text-2xl font-bold text-white sm:text-4xl">
          {greeting()}, {ownerName}!
        </h1>
        <p className="mt-2 text-sm text-white/85">
          {actionQueueCount > 0 ? (
            <>
              You have {actionQueueCount} task{actionQueueCount === 1 ? "" : "s"} in your queue today. Let&apos;s
              get started! 👋
            </>
          ) : (
            <>You&apos;re all caught up — nothing waiting in your queue right now. 🎉</>
          )}
        </p>
        {actionQueueCount > 0 && (
          <Link
            href="#action-queue"
            className="mt-3 inline-block text-sm font-semibold text-white underline underline-offset-2 hover:text-white/80"
          >
            Review it
          </Link>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no raster optimization needed */}
      <img
        src="/welcoming-user.svg"
        alt=""
        className="pointer-events-none absolute right-2 bottom-0 z-20 hidden h-[130%] max-h-80 w-auto md:block"
      />
    </div>
  );
}
