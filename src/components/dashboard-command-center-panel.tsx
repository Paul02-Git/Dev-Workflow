import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { SquarePlatformIcon, resolvePlatformLoginUrl } from "@/components/platform-icon";
import { DashboardPanelProjectPicker } from "@/components/dashboard-panel-project-picker";
import { DashboardStartTaskButton } from "@/components/dashboard-start-task-button";
import { DashboardPanelNotes } from "@/components/dashboard-panel-notes";
import { ArrowRightIcon } from "lucide-react";

const PROJECT_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-[#eef2fb] text-[#2a4d8f]" },
  ON_HOLD: { label: "On Hold", className: "bg-[#fef4de] text-[#8a5c00]" },
  LAUNCHED: { label: "Launched", className: "bg-[#eafaea] text-[#0ca30c]" },
  ARCHIVED: { label: "Archived", className: "bg-black/5 text-muted-foreground" },
};

const ACCESS_STATUS_LABELS: Record<string, string> = {
  NOT_REQUESTED: "Not requested",
  REQUESTED: "Requested",
  INVITED: "Invited",
  GRANTED: "Verified",
  VERIFIED: "Verified",
  NOT_NEEDED: "Not needed",
};
const ACCESS_STATUS_COLORS: Record<string, string> = {
  NOT_REQUESTED: "#898781",
  REQUESTED: "#c9720a",
  INVITED: "#c9720a",
  GRANTED: "#0ca30c",
  VERIFIED: "#0ca30c",
  NOT_NEEDED: "#898781",
};
const ACCESS_STATUS_BG: Record<string, string> = {
  NOT_REQUESTED: "#f1f0ee",
  REQUESTED: "#fef4de",
  INVITED: "#fef4de",
  GRANTED: "#eafaea",
  VERIFIED: "#eafaea",
  NOT_NEEDED: "#f1f0ee",
};

const PRIORITY_LABEL_COLOR: Record<string, string> = {
  CRITICAL: "#d03b3b",
  HIGH: "#c9720a",
  MEDIUM: "#52514e",
  LOW: "#898781",
};
const ESTIMATE_MINUTES: Record<string, number> = { CRITICAL: 45, HIGH: 30, MEDIUM: 20, LOW: 10 };

type SwitcherProject = {
  id: string;
  name: string;
  clientName: string;
  status: string;
  technologyNames: string[];
};

type AccessItemRow = {
  id: string;
  name: string;
  url: string | null;
  status: string;
};

type NextActionTask = {
  id: string;
  title: string;
  isCritical: boolean;
  priority: string;
};

export function DashboardCommandCenterPanel({
  project,
  progressPercent,
  launchReadinessPercent,
  nextAction,
  accessItems,
  notes,
  switcherProjects,
  isAuto,
}: {
  project: { id: string; name: string; status: string } | null;
  progressPercent: number;
  launchReadinessPercent: number | null;
  nextAction: NextActionTask | null;
  accessItems: AccessItemRow[];
  notes: string | null;
  switcherProjects: SwitcherProject[];
  isAuto: boolean;
}) {
  if (!project) {
    return (
      <Card>
        <CardContent>
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Project Command Center</span>
          <p className="mt-2 text-sm text-muted-foreground">
            No projects yet.{" "}
            <Link href="/projects/new" className="text-primary hover:underline">
              Create one
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  const statusMeta = PROJECT_STATUS_LABEL[project.status] ?? { label: project.status, className: "bg-black/5 text-muted-foreground" };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Project Command Center</CardTitle>
          <CardAction>
            <DashboardPanelProjectPicker projects={switcherProjects} selectedId={project.id} isAuto={isAuto} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex items-center justify-between gap-2">
            <Link href={`/projects/${project.id}`} className="truncate text-lg font-bold hover:underline">
              {project.name}
            </Link>
            <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Progress</div>
              <div className="mb-1.5 text-lg font-bold">{progressPercent}%</div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Launch Readiness</div>
              <div className="mb-1.5 text-lg font-bold">{launchReadinessPercent === null ? "—" : `${launchReadinessPercent}%`}</div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full bg-[#0ca30c]" style={{ width: `${launchReadinessPercent ?? 0}%` }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {nextAction && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <ArrowRightIcon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 text-xs font-semibold uppercase text-muted-foreground">Next Action</div>
                <div className="truncate text-sm font-semibold">{nextAction.title}</div>
                <div
                  className="mt-0.5 text-xs font-medium"
                  style={{ color: PRIORITY_LABEL_COLOR[nextAction.isCritical ? "CRITICAL" : nextAction.priority] }}
                >
                  {nextAction.isCritical ? "Critical Priority" : `${nextAction.priority} Priority`} · ~
                  {ESTIMATE_MINUTES[nextAction.priority] ?? 20}m
                </div>
              </div>
              <DashboardStartTaskButton taskId={nextAction.id} projectId={project.id} />
            </div>
          </CardContent>
        </Card>
      )}

      {accessItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold">Links & Access</CardTitle>
            <CardAction>
              <Link href={`/projects/${project.id}`} className="text-sm font-semibold text-primary hover:underline">
                Edit
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              {accessItems.map((item) => {
                const url = item.url || resolvePlatformLoginUrl(item.name);
                const content = (
                  <>
                    <SquarePlatformIcon name={item.name} size={30} />
                    <span className="w-full truncate text-xs font-medium text-foreground">{item.name}</span>
                  </>
                );
                return url ? (
                  <a
                    key={item.id}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 rounded-lg border border-border p-3 text-center hover:bg-muted"
                  >
                    {content}
                  </a>
                ) : (
                  <div
                    key={item.id}
                    title="No URL saved and no known login page for this platform"
                    className="flex flex-col items-center gap-2 rounded-lg border border-border p-3 text-center opacity-50"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {accessItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold">Integration Verification</CardTitle>
            <CardAction>
              <Link href={`/projects/${project.id}`} className="text-sm font-semibold text-primary hover:underline">
                View All
              </Link>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {accessItems.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <SquarePlatformIcon name={item.name} size={24} />
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">{item.name}</span>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ backgroundColor: ACCESS_STATUS_BG[item.status], color: ACCESS_STATUS_COLORS[item.status] }}
                  >
                    {ACCESS_STATUS_LABELS[item.status] ?? item.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <DashboardPanelNotes key={project.id} projectId={project.id} notes={notes} />
        </CardContent>
      </Card>
    </div>
  );
}
