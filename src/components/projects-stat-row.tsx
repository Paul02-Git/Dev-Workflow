import { FolderIcon, ActivityIcon, HeartPulseIcon, RocketIcon } from "lucide-react";
import { IconStatCard } from "@/components/project-pulse-cards";

export function ProjectsStatRow({
  totalCount,
  activeCount,
  avgActiveHealth,
  launchingSoonCount,
}: {
  totalCount: number;
  activeCount: number;
  avgActiveHealth: number | null;
  launchingSoonCount: number;
}) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <IconStatCard
        icon={<FolderIcon className="size-5" />}
        iconColor="#2a78d6"
        iconBg="#e8f0fb"
        label="Total Projects"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold">{totalCount}</div>
        <span className="text-xs text-muted-foreground">Across every client</span>
      </IconStatCard>

      <IconStatCard
        icon={<ActivityIcon className="size-5" />}
        iconColor="#0ca30c"
        iconBg="#eafaea"
        label="Active Now"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold">{activeCount}</div>
        <span className="text-xs text-muted-foreground">Currently in progress</span>
      </IconStatCard>

      <IconStatCard
        icon={<HeartPulseIcon className="size-5" />}
        iconColor="#c9720a"
        iconBg="#fef4de"
        label="Avg. Health"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold">{avgActiveHealth === null ? "—" : `${avgActiveHealth}%`}</div>
        <span className="text-xs text-muted-foreground">Across active projects</span>
      </IconStatCard>

      <IconStatCard
        icon={<RocketIcon className="size-5" />}
        iconColor="#a259ff"
        iconBg="#f2e9fe"
        label="Launching Soon"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold">{launchingSoonCount}</div>
        <span className="text-xs text-muted-foreground">Within the next 7 days</span>
      </IconStatCard>
    </div>
  );
}
