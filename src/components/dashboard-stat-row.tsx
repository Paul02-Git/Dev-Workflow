import Link from "next/link";
import { FolderIcon, ListChecksIcon, ClockIcon, RocketIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

function StatTile({
  icon,
  iconColor,
  iconBg,
  label,
  value,
  sub,
  subHref,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  value: number;
  sub: string;
  subHref?: string;
}) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="mb-3 flex items-center gap-2.5">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: iconBg, color: iconColor }}
          >
            {icon}
          </span>
          <h2 className="truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</h2>
        </div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {subHref ? (
          <Link href={subHref} className="text-xs text-link hover:underline">
            {sub}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">{sub}</span>
        )}
      </CardContent>
    </Card>
  );
}

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
      <StatTile
        icon={<FolderIcon className="size-5" />}
        iconColor="#2a78d6"
        iconBg="#e8f0fb"
        label="Active Projects"
        value={activeProjectsCount}
        sub="View all projects →"
        subHref="/projects"
      />
      <StatTile
        icon={<ListChecksIcon className="size-5" />}
        iconColor="#c9720a"
        iconBg="#fef4de"
        label="My Action Queue"
        value={actionQueueCount}
        sub="Tasks to do today"
      />
      <StatTile
        icon={<ClockIcon className="size-5" />}
        iconColor="#c9720a"
        iconBg="#fef4de"
        label="Waiting On Client"
        value={waitingOnClientCount}
        sub={waitingOnClientCount === 0 ? "Nothing blocked" : "Projects blocked"}
      />
      <StatTile
        icon={<RocketIcon className="size-5" />}
        iconColor="#0ca30c"
        iconBg="#eafaea"
        label="Ready To Launch"
        value={readyToLaunchCount}
        sub={readyToLaunchCount > 0 ? "Almost there! 🎉" : "None yet"}
      />
    </div>
  );
}
