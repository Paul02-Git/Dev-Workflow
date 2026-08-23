import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivityIcon, AlertTriangleIcon, FlagIcon, RocketIcon, CheckCircle2Icon } from "lucide-react";
import type { ProjectPulseSummary } from "@/lib/queries/projects";

export function healthState(score: number): { label: string; color: string; bg: string } {
  if (score >= 85) return { label: "On track", color: "#0ca30c", bg: "#eafaea" };
  if (score >= 60) return { label: "At risk", color: "#c9720a", bg: "#fef4de" };
  return { label: "Behind", color: "#d03b3b", bg: "#fbe6e6" };
}

export function launchState(
  daysToLaunch: number | null
): { value: string; sub: string; status: string; color: string; bg: string } {
  if (daysToLaunch === null) return { value: "—", sub: "No target date set", status: "No date", color: "#898781", bg: "#f1f0ee" };
  if (daysToLaunch < 0)
    return { value: `${Math.abs(daysToLaunch)}d`, sub: "Past planned launch", status: "Overdue", color: "#d03b3b", bg: "#fbe6e6" };
  if (daysToLaunch === 0) return { value: "Today", sub: "Planned launch is today", status: "Launch day", color: "#c9720a", bg: "#fef4de" };
  if (daysToLaunch <= 7)
    return { value: `${daysToLaunch}d`, sub: "Until planned launch", status: "Coming up", color: "#c9720a", bg: "#fef4de" };
  return { value: `${daysToLaunch}d`, sub: "Until planned launch", status: "On schedule", color: "#0ca30c", bg: "#eafaea" };
}

export function IconStatCard({
  icon,
  iconColor,
  iconBg,
  label,
  action,
  children,
  iconSize = "h-6 w-6",
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Container size classes for the icon circle — defaults to the size used everywhere this card already appears (project page Pulse/Overview). Dashboard's stat row opts into a bigger one. */
  iconSize?: string;
}) {
  return (
    <Card className="min-w-0 gap-2 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`flex shrink-0 items-center justify-center rounded-full ${iconSize}`}
            style={{ backgroundColor: iconBg, color: iconColor }}
          >
            {icon}
          </span>
          <h2 className="truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</h2>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/**
 * The 4-card Project Pulse row — health, Needs Attention (with a preview,
 * not the full list), Next Milestone, Launch Countdown. Shared between the
 * dashboard (one row per active project, wrapped with a name/client
 * header) and a single project's own Command Center tab (rendered bare —
 * the project's identity is already shown in the page header above it).
 */
export function ProjectPulseCards({ summary }: { summary: ProjectPulseSummary }) {
  const health = healthState(summary.healthScore);
  const launch = launchState(summary.daysToLaunch);
  const criticalIssues = summary.issues.length;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* Card 1 — Project Pulse: overall health at a glance */}
      <IconStatCard
        icon={<ActivityIcon className="size-5" />}
        iconColor={health.color}
        iconBg={health.bg}
        label="Project Pulse"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold" style={{ color: health.color }}>
          {summary.healthScore}%
        </div>
        <div className="text-xs text-muted-foreground">
          {summary.tasksDone} / {summary.tasksTotal} tasks complete
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full" style={{ width: `${summary.healthScore}%`, backgroundColor: health.color }} />
        </div>
      </IconStatCard>

      {/* Card 2 — Next Milestone: what comes next */}
      <IconStatCard
        icon={<FlagIcon className="size-5" />}
        iconColor="#2a78d6"
        iconBg="#e8f0fb"
        label="Next Milestone"
        iconSize="h-9 w-9"
      >
        <div className="truncate text-xl font-bold text-foreground">{summary.milestoneName ?? "Complete"}</div>
        {summary.milestonePercent !== null ? (
          <>
            <div className="text-xs text-muted-foreground">{summary.milestonePercent}% complete</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${summary.milestonePercent}%` }} />
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">No stages yet</div>
        )}
      </IconStatCard>

      {/* Card 3 — Needs Attention: what could slow this project down, preview only */}
      <IconStatCard
        icon={criticalIssues > 0 ? <AlertTriangleIcon className="size-5" /> : <CheckCircle2Icon className="size-5" />}
        iconColor={criticalIssues > 0 ? "#c9720a" : "#0ca30c"}
        iconBg={criticalIssues > 0 ? "#fef4de" : "#eafaea"}
        label="Needs Attention"
        iconSize="h-9 w-9"
      >
        <div className="text-2xl font-bold" style={{ color: criticalIssues > 0 ? "#c9720a" : "#0ca30c" }}>
          {criticalIssues}
        </div>
        {criticalIssues === 0 ? (
          <div className="text-xs text-muted-foreground">Nothing flagged</div>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              {criticalIssues} critical item{criticalIssues === 1 ? "" : "s"}
            </div>
            <ul className="space-y-0.5">
              {summary.issues.slice(0, 3).map((issue) => (
                <li key={issue.id} className="truncate text-xs text-[#52514e]">
                  • {issue.message}
                </li>
              ))}
            </ul>
          </>
        )}
      </IconStatCard>

      {/* Card 4 — Launch Countdown: urgency */}
      <IconStatCard
        icon={<RocketIcon className="size-5" />}
        iconColor={launch.color}
        iconBg={launch.bg}
        label="Launch Countdown"
        iconSize="h-9 w-9"
        action={
          <Badge className="shrink-0" style={{ backgroundColor: launch.bg, color: launch.color }}>
            {launch.status}
          </Badge>
        }
      >
        <div className="text-2xl font-bold" style={{ color: launch.color }}>
          {launch.value}
        </div>
        <div className="text-xs text-muted-foreground">{launch.sub}</div>
      </IconStatCard>
    </div>
  );
}
