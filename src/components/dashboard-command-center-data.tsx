import { getProjectDetail, listProjectsForSwitcher } from "@/lib/queries/projects";
import { listAccessItems } from "@/lib/queries/access-items";
import { withTimeout } from "@/lib/with-timeout";
import { DashboardCommandCenterPanel } from "@/components/dashboard-command-center-panel";

const PRIORITY_WEIGHT: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * Fetches and derives everything the Command Center panel needs on its
 * own, meant to be rendered inside its own <Suspense> boundary on the
 * dashboard page. getProjectDetail does a real multi-table join fan-out
 * (project + stages + tasks + tags + attachments...) and used to sit as a
 * single blocking await in the middle of the whole dashboard page's
 * render — nothing on the page, not even the header, could show until
 * that one fetch finished. Isolated here, the rest of the dashboard can
 * stream in without waiting on it; this panel just fills in a moment
 * later once its own data is ready.
 */
export async function DashboardCommandCenterData({
  featuredProjectId,
  organizationId,
  switcherProjects,
  isAuto,
}: {
  featuredProjectId: string | null;
  organizationId: string;
  switcherProjects: Awaited<ReturnType<typeof listProjectsForSwitcher>>;
  isAuto: boolean;
}) {
  const [featuredDetail, featuredAccessItems] = featuredProjectId
    ? await withTimeout(
        Promise.all([getProjectDetail(featuredProjectId, organizationId), listAccessItems(featuredProjectId, organizationId)]),
        8000,
        "dashboard featured panel"
      )
    : [null, []];

  let panelProject: { id: string; name: string; status: string } | null = null;
  let progressPercent = 0;
  let launchReadinessPercent: number | null = null;
  let nextAction: { id: string; title: string; isCritical: boolean; priority: string } | null = null;

  if (featuredDetail) {
    panelProject = { id: featuredDetail.project.id, name: featuredDetail.project.name, status: featuredDetail.project.status };

    const featuredTopLevel = featuredDetail.tasks.filter((t) => !t.parentTaskId);
    const done = featuredTopLevel.filter((t) => t.effectiveStatus === "DONE").length;
    progressPercent = featuredTopLevel.length > 0 ? Math.round((done / featuredTopLevel.length) * 100) : 0;

    const criticalTasks = featuredTopLevel.filter((t) => t.isCritical);
    const criticalDone = criticalTasks.filter((t) => t.effectiveStatus === "DONE").length;
    launchReadinessPercent = criticalTasks.length > 0 ? Math.round((criticalDone / criticalTasks.length) * 100) : null;

    const actionable = featuredTopLevel
      .filter((t) => t.effectiveStatus !== "DONE" && t.effectiveStatus !== "SKIPPED" && t.effectiveStatus !== "BLOCKED")
      .sort((a, b) => {
        if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
        return (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9);
      });
    const next = actionable[0];
    if (next) nextAction = { id: next.id, title: next.title, isCritical: next.isCritical, priority: next.priority };
  }

  return (
    <DashboardCommandCenterPanel
      project={panelProject}
      progressPercent={progressPercent}
      launchReadinessPercent={launchReadinessPercent}
      nextAction={nextAction}
      accessItems={featuredAccessItems}
      notes={featuredDetail?.project.notes ?? null}
      switcherProjects={switcherProjects}
      isAuto={isAuto}
    />
  );
}
