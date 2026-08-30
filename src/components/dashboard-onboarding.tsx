import Link from "next/link";
import { FolderPlusIcon, UsersIcon } from "lucide-react";

/**
 * Shown instead of the regular dashboard grid when the organization has no
 * projects yet — every other dashboard card (action queue, blockers, ready
 * to launch, Command Center...) is derived from project data, so rendering
 * them for a brand-new org just produces a wall of "nothing here" empty
 * states. A single centered welcome screen with the two real ways to get
 * started is clearer than a dozen empty cards.
 */
export function DashboardOnboarding({ ownerName }: { ownerName: string }) {
  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no raster optimization needed */}
      <img src="/undraw-donut-love.svg" alt="Donut Love" width={420} height={270} className="w-72 sm:w-150" />

      <div className="max-w-xl">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">Welcome to DEVOS</p>
        <h2 className="mb-3 text-2xl font-bold text-foreground">
          Let&apos;s get your first project running, {ownerName}.
        </h2>
        <p className="text-sm text-muted-foreground">
          Invite a client to complete their own intake form, or create the project yourself. DEVOS will automatically build a complete, stage-by-stage task list to keep everything on track.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/projects/new"
          className="flex items-center gap-2 rounded-md bg-[#262626] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          <FolderPlusIcon className="size-4" />
          Create Project
        </Link>
        <Link
          href="/clients"
          className="flex items-center gap-2 rounded-md border border-black/15 bg-white px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
        >
          <UsersIcon className="size-4" />
          Invite Client
        </Link>
      </div>
    </div>
  );
}
