import Link from "next/link";
import {
  listProjects,
  listAllTasks,
  listRecentActivityAcrossProjects,
  listProjectsForSwitcher,
  getProjectDetail,
  deriveActionQueue,
  deriveWaitingOnClient,
  deriveBlockedProjects,
  deriveReadyToLaunch,
  deriveLaunchReadinessRanking,
  deriveOverdueLaunches,
} from "@/lib/queries/projects";
import { listAccessItems } from "@/lib/queries/access-items";
import { listDueMaintenancePlans } from "@/lib/queries/maintenance";
import { withTimeout } from "@/lib/with-timeout";
import { requireAuth } from "@/lib/auth";
import { GenerateMaintenanceButton } from "@/components/generate-maintenance-button";
import { SearchTrigger } from "@/components/search-trigger";
import { DashboardStatRow } from "@/components/dashboard-stat-row";
import { DashboardActionQueue } from "@/components/dashboard-action-queue";
import { DashboardActiveProjects } from "@/components/dashboard-active-projects";
import { DashboardWaitingOnClient } from "@/components/dashboard-waiting-on-client";
import { DashboardBlockers } from "@/components/dashboard-blockers";
import { DashboardReadyToLaunch } from "@/components/dashboard-ready-to-launch";
import { DashboardRecentActivity } from "@/components/dashboard-recent-activity";
import { DashboardCommandCenterPanel } from "@/components/dashboard-command-center-panel";

const PRIORITY_WEIGHT: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string }>;
}) {
  const { organizationId } = await requireAuth();
  const { panel } = await searchParams;

  // Timeout-protected and fault-tolerant on its own, separate from the
  // main Promise.all below — a failure here (tech badges, panel picker)
  // shouldn't take down the rest of the dashboard's real data.
  let switcherProjects: Awaited<ReturnType<typeof listProjectsForSwitcher>> = [];
  try {
    switcherProjects = await withTimeout(listProjectsForSwitcher(organizationId), 5000, "project switcher");
  } catch {
    // swallow — empty switcher is an acceptable degraded state
  }

  const [projects, allTasks, activity, duePlans] = await withTimeout(
    Promise.all([
      listProjects(organizationId),
      listAllTasks(organizationId),
      listRecentActivityAcrossProjects(organizationId, 16),
      listDueMaintenancePlans(organizationId),
    ]),
    8000,
    "dashboard top queries"
  );

  const activeProjects = projects.filter((p) => p.status === "ACTIVE");
  const topLevelTasks = allTasks.filter((t) => !t.parentTaskId);

  const actionQueue = deriveActionQueue(allTasks);
  const waitingOnClient = deriveWaitingOnClient(allTasks);
  const blockedProjects = deriveBlockedProjects(allTasks);
  const readyToLaunch = deriveReadyToLaunch(allTasks);
  const launchRanking = deriveLaunchReadinessRanking(allTasks);
  const overdueLaunches = deriveOverdueLaunches(allTasks, projects);

  const technologiesByProject = new Map(switcherProjects.map((p) => [p.id, p.technologyNames]));

  const activeProjectsWithProgress = activeProjects.map((p) => {
    const projectTasks = topLevelTasks.filter((t) => t.projectId === p.id);
    const tasksDone = projectTasks.filter((t) => t.effectiveStatus === "DONE").length;
    return {
      id: p.id,
      name: p.name,
      clientName: p.clientName,
      projectType: p.projectType,
      primaryTech: technologiesByProject.get(p.id)?.[0] ?? null,
      tasksDone,
      tasksTotal: projectTasks.length,
    };
  });

  // The Command Center panel defaults to whichever active project ranks #1
  // by launch readiness — the closest-to-launch project is the one most
  // worth keeping an eye on day to day. `?panel=<id>` overrides this pick
  // (set by the panel's own project switcher) and can point at any
  // project, not just active ones.
  const isAuto = !panel;
  const featuredProjectId = panel ?? launchRanking[0]?.projectId ?? projects[0]?.id ?? null;

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
    <div className="flex w-full items-start gap-4">
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl font-bold">Dashboard</h1>
            <p className="text-md text-muted-foreground">{greeting()}, Paul! 👋</p>
          </div>
          <div className="flex items-center gap-2">
            <SearchTrigger className="mb-0 w-64" placeholder="Search projects, tasks, SOPs…" />
            <Link
              href="/projects/new"
              className="shrink-0 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              + New Project
            </Link>
          </div>
        </div>

        <DashboardStatRow
          activeProjectsCount={activeProjects.length}
          actionQueueCount={actionQueue.length}
          waitingOnClientCount={waitingOnClient.length}
          readyToLaunchCount={readyToLaunch.length}
        />

        {overdueLaunches.length > 0 && (
          <div className="mb-4 rounded-lg border border-[#f3d4d4] bg-[#fdf5f5] p-4">
            <h2 className="mb-2 text-sm font-semibold text-[#d03b3b]">Launch overdue</h2>
            <ul className="divide-y divide-border">
              {overdueLaunches.map((p) => (
                <li key={p.projectId} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{p.projectName}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.clientName} · was due {new Date(p.targetLaunchDate).toLocaleDateString()} ·{" "}
                      {p.daysOverdue === 0 ? "today" : `${p.daysOverdue}d overdue`} · {p.criticalDone}/
                      {p.criticalTotal} critical tasks done
                    </div>
                  </div>
                  <Link
                    href={`/projects/${p.projectId}?tab=tasks#launch-checklist`}
                    className="shrink-0 rounded-md border border-black/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-muted"
                  >
                    View checklist
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {duePlans.length > 0 && (
          <div className="mb-4 rounded-lg border border-border bg-[#fef4de] p-4">
            <h2 className="mb-2 text-sm font-semibold text-[#8a5c00]">Maintenance due</h2>
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

        <div className="mb-4 grid grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
          <DashboardActionQueue items={actionQueue} />
          <DashboardActiveProjects projects={activeProjectsWithProgress} featuredProjectId={featuredProjectId} />
        </div>

        <div className="mb-4 grid grid-cols-1 items-stretch gap-3 lg:grid-cols-3">
          <DashboardWaitingOnClient items={waitingOnClient} />
          <DashboardBlockers items={blockedProjects} />
          <DashboardReadyToLaunch
            items={readyToLaunch.map((r) => ({ ...r, primaryTech: technologiesByProject.get(r.projectId)?.[0] ?? null }))}
          />
        </div>

        <DashboardRecentActivity
          activity={activity.map((row) => ({ ...row, primaryTech: technologiesByProject.get(row.projectId)?.[0] ?? null }))}
        />
      </div>

      <div className="sticky top-4 hidden w-[450px] shrink-0 xl:block">
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
      </div>
    </div>
  );
}
