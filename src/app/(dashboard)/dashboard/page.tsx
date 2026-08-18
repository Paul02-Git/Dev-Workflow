import Link from "next/link";
import { listProjects, getProjectIssues, getNextActions, listProjectPulseSummaries } from "@/lib/queries/projects";
import { listDueMaintenancePlans } from "@/lib/queries/maintenance";
import { GenerateMaintenanceButton } from "@/components/generate-maintenance-button";
import { DashboardProjectPulse } from "@/components/dashboard-project-pulse";

function healthColor(score: number) {
  if (score >= 85) return "#0ca30c";
  if (score >= 60) return "#fab219";
  return "#d03b3b";
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const [projects, nextActions, duePlans, pulseSummaries] = await Promise.all([
    listProjects(),
    getNextActions(),
    listDueMaintenancePlans(),
    listProjectPulseSummaries(),
  ]);

  const issuesByProject = await Promise.all(
    projects.map(async (p) => ({ project: p, issues: await getProjectIssues(p.id) }))
  );
  const allIssues = issuesByProject.flatMap((x) =>
    x.issues.map((issue) => ({ ...issue, projectName: x.project.name }))
  );

  const avgHealth = projects.length
    ? Math.round(projects.reduce((sum, p) => sum + p.healthScore, 0) / projects.length)
    : 0;
  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;
  const totalEstimateMinutes = nextActions.reduce((sum, a) => sum + a.estimateMinutes, 0);
  const hours = Math.floor(totalEstimateMinutes / 60);
  const minutes = totalEstimateMinutes % 60;
  const estimateLabel = [hours > 0 ? `${hours}h` : null, minutes > 0 ? `${minutes}m` : null]
    .filter(Boolean)
    .join(" ") || "0m";

  return (
    <div className="max-w-6xl">
      <h1 className="mb-1 text-xl font-semibold">
        {greeting()}, Paul
      </h1>
      <p className="mb-6 text-sm text-[#52514e]">
        {activeCount} active project(s) · avg health {avgHealth}%
      </p>

      <div className="mb-8 rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Next Actions</h2>
          <span className="text-xs font-medium text-muted-foreground">Estimated work: {estimateLabel}</span>
        </div>
        {nextActions.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Nothing actionable right now — every active project is either fully done or blocked.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {nextActions.map((a) => (
              <li key={a.projectId}>
                <Link
                  href={`/projects/${a.projectId}`}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-muted"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{a.projectName}</div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="text-primary">→</span>
                      {a.task.title}
                      {a.task.isCritical && (
                        <span className="rounded-full bg-[#fbe6e6] px-1.5 py-0.5 text-[10px] font-bold text-[#d03b3b]">
                          CRITICAL
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">~{a.estimateMinutes}m</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {duePlans.length > 0 && (
        <div className="mb-8 rounded-xl border border-border bg-[#fef4de] p-5">
          <h2 className="mb-3 text-sm font-semibold text-[#8a5c00]">Maintenance due</h2>
          <ul className="divide-y divide-border">
            {duePlans.map((plan) => (
              <li key={plan.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{plan.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {plan.projectName} · {plan.clientName} · due {new Date(plan.nextDueAt).toLocaleDateString()}
                  </div>
                </div>
                <GenerateMaintenanceButton planId={plan.id} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold text-[#52514e]">Active projects</div>
          <div className="text-2xl font-bold">{activeCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold text-[#52514e]">Avg health</div>
          <div className="text-2xl font-bold" style={{ color: healthColor(avgHealth) }}>
            {avgHealth}%
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold text-[#52514e]">Potential issues</div>
          <div className="text-2xl font-bold">{allIssues.length}</div>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold">Project Pulse</h2>
      {pulseSummaries.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          No active projects yet.{" "}
          <Link href="/projects/new" className="text-primary">
            Create one
          </Link>
          .
        </div>
      ) : (
        pulseSummaries.map((summary) => <DashboardProjectPulse key={summary.id} summary={summary} />)
      )}
    </div>
  );
}
