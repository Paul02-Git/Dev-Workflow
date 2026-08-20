import Link from "next/link";
import { FolderIcon, ListChecksIcon, ClockIcon, RocketIcon } from "lucide-react";
import { IconStatCard } from "@/components/project-pulse-cards";

export function DashboardStatRow({
  activeProjectsCount,
  actionQueueCount,
  waitingOnClientCount,
  readyToLaunchCount,
}: {
  activeProjectsCount: number;
  actionQueueCount: number;
  waitingOnClientCount: number;
  readyToLaunchCount: number;
}) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <IconStatCard
        icon={<FolderIcon className="size-5" />}
        iconColor="#2a78d6"
        iconBg="#e8f0fb"
        label="Active Projects"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold">{activeProjectsCount}</div>
        <Link href="/projects" className="text-xs text-primary hover:underline">
          View all projects →
        </Link>
      </IconStatCard>

      <IconStatCard
        icon={<ListChecksIcon className="size-5" />}
        iconColor="#c9720a"
        iconBg="#fef4de"
        label="My Action Queue"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold">{actionQueueCount}</div>
        <span className="text-xs text-muted-foreground">Tasks to do today</span>
      </IconStatCard>

      <IconStatCard
        icon={<ClockIcon className="size-5" />}
        iconColor="#c9720a"
        iconBg="#fef4de"
        label="Waiting On Client"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold">{waitingOnClientCount}</div>
        <span className="text-xs text-muted-foreground">
          {waitingOnClientCount === 0 ? "Nothing blocked" : "Projects blocked"}
        </span>
      </IconStatCard>

      <IconStatCard
        icon={<RocketIcon className="size-5" />}
        iconColor="#0ca30c"
        iconBg="#eafaea"
        label="Ready To Launch"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold">{readyToLaunchCount}</div>
        <span className="text-xs text-muted-foreground">{readyToLaunchCount > 0 ? "Almost there! 🎉" : "None yet"}</span>
      </IconStatCard>
    </div>
  );
}
