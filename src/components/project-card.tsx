import Link from "next/link";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  ClockIcon,
  RocketIcon,
  CheckCircle2Icon,
  ArrowUpRightIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PlatformBadge } from "@/components/platform-icon";
import { healthState, launchState } from "@/components/project-pulse-cards";
import { hashPick } from "@/lib/hash-color";
import { STATUS_LABEL, PRIORITY_DOT, PROJECT_COLOR_PALETTE, progressColor, formatDate } from "@/lib/project-display";
import type { ProjectCardSummary } from "@/lib/queries/projects";
import { PinProjectButton } from "@/components/pin-project-button";
import { ProjectRowActions } from "@/components/project-row-actions";

export type ProjectCardData = {
  id: string;
  name: string;
  projectType: string;
  status: string;
  healthScore: number;
  isPinned: boolean;
  clientName: string;
  clientId: string;
  domain: string | null;
  createdAt: Date | string;
  targetLaunchDate: Date | string | null;
  launchedAt: Date | string | null;
  daysToLaunch: number | null;
  technologyNames: string[];
  summary: ProjectCardSummary;
};

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const {
    id,
    name,
    projectType,
    status,
    healthScore,
    isPinned,
    clientName,
    clientId,
    domain,
    launchedAt,
    daysToLaunch,
    technologyNames,
    summary,
  } = project;

  const isArchived = status === "ARCHIVED";
  const isLaunched = status === "LAUNCHED";
  const statusMeta = STATUS_LABEL[status] ?? STATUS_LABEL.ACTIVE;
  const health = healthState(healthScore);
  const launch = launchState(daysToLaunch);
  const progressPercent = summary.tasksTotal > 0 ? Math.round((summary.tasksDone / summary.tasksTotal) * 100) : 0;
  const pColor = progressColor(progressPercent);

  // Show the single most important flag rather than every one at once —
  // blocked work beats a client waiting on something beats a background
  // "check project" issue, in roughly that order of how urgently it needs
  // the project owner's attention.
  const attention = summary.blockedTaskTitle
    ? { icon: AlertCircleIcon, color: "#d03b3b", bg: "#fbe6e6", label: "Blocked", detail: summary.blockedTaskTitle }
    : summary.waitingTaskTitle
      ? { icon: ClockIcon, color: "#2a78d6", bg: "#eef2fb", label: "Waiting on client", detail: summary.waitingTaskTitle }
      : summary.issues.length > 0
        ? {
            icon: AlertTriangleIcon,
            color: "#c9720a",
            bg: "#fef4de",
            label: `${summary.issues.length} potential issue${summary.issues.length === 1 ? "" : "s"}`,
            detail: summary.issues[0].message,
          }
        : null;

  const avatarColor = hashPick(clientName, PROJECT_COLOR_PALETTE);

  return (
    <Link
      href={`/projects/${id}`}
      className={`app-card group flex flex-col gap-3 p-4 transition hover:shadow-md ${
        isLaunched ? "border-[#cdeecd] bg-[#f5fbf5] hover:border-[#0ca30c]/40" : "hover:border-primary/50"
      } ${isArchived ? "opacity-70 grayscale-[0.3]" : ""}`}
    >
      {/* Identity row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: avatarColor }}
          >
            {clientName.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-link">{name}</h3>
              <ArrowUpRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {clientName}
              {domain && <span className="text-muted-foreground/70"> · {domain}</span>}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
          <PinProjectButton projectId={id} pinned={isPinned} />
          <ProjectRowActions
            projectId={id}
            projectName={name}
            currentStatus={status}
            clientId={clientId}
            isPinned={isPinned}
          />
        </div>
      </div>

      {/* Tech stack + project type */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {technologyNames.slice(0, 4).map((techName) => (
            <PlatformBadge key={techName} name={techName} size={22} />
          ))}
          {technologyNames.length > 4 && (
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-black/5 text-xs font-semibold text-muted-foreground">
              +{technologyNames.length - 4}
            </span>
          )}
          {technologyNames.length === 0 && <span className="text-xs text-muted-foreground">No technologies set</span>}
        </div>
        <span className="shrink-0 truncate text-xs text-muted-foreground">{projectType}</span>
      </div>

      {/* Progress */}
      <div>
        <div className="mb-1 flex items-end justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progress</span>
          <span className="text-xs text-muted-foreground">
            {summary.tasksDone}/{summary.tasksTotal} tasks
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
            <div className="h-full rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: pColor }} />
          </div>
          <span className="w-9 shrink-0 text-right text-xs font-bold" style={{ color: pColor }}>
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Health + launch mini-stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: health.color }} />
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Health</div>
            <div className="truncate text-xs font-semibold" style={{ color: health.color }}>
              {health.label}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
          {isLaunched ? (
            <>
              <RocketIcon className="size-3.5 shrink-0" style={{ color: "#0ca30c" }} />
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Launched</div>
                <div className="truncate text-xs font-semibold text-foreground">
                  {launchedAt ? formatDate(launchedAt) : "—"}
                </div>
              </div>
            </>
          ) : (
            <>
              <RocketIcon className="size-3.5 shrink-0" style={{ color: launch.color }} />
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Launch</div>
                <div className="truncate text-xs font-semibold" style={{ color: launch.color }}>
                  {launch.value}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Attention flag — the one thing most worth knowing before opening the project */}
      {attention && !isArchived && (
        <div className="flex items-start gap-2 rounded-md p-2" style={{ backgroundColor: attention.bg }}>
          <attention.icon className="mt-0.5 size-3.5 shrink-0" style={{ color: attention.color }} />
          <div className="min-w-0 text-xs">
            <span className="font-semibold" style={{ color: attention.color }}>
              {attention.label}
            </span>
            <span className="text-foreground/80"> — {attention.detail}</span>
          </div>
        </div>
      )}

      {/* Next action footer */}
      {!isArchived && (
        <div className="mt-auto flex items-center gap-2 border-t border-border pt-2.5 text-xs">
          {summary.nextAction ? (
            <>
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: PRIORITY_DOT[summary.nextAction.priority] ?? "#898781" }}
              />
              <span className="truncate text-muted-foreground">
                Next: <span className="text-foreground">{summary.nextAction.title}</span>
              </span>
            </>
          ) : (
            <>
              <CheckCircle2Icon className="size-3.5 shrink-0 text-[#0ca30c]" />
              <span className="text-muted-foreground">
                {summary.tasksTotal === 0 ? "No tasks generated yet" : "All caught up"}
              </span>
            </>
          )}
        </div>
      )}
    </Link>
  );
}
