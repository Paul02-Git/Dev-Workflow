import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  listProjects,
  listAllTasks,
  listRecentActivityAcrossProjects,
  listProjectsForSwitcher,
  deriveActionQueue,
  deriveWaitingOnClient,
  deriveBlockedProjects,
  deriveReadyToLaunch,
  deriveLaunchReadinessRanking,
  deriveOverdueLaunches,
} from "@/lib/queries/projects";
import { listDueMaintenancePlans } from "@/lib/queries/maintenance";
import { isClientActivity } from "@/lib/format-activity";
import { withTimeout } from "@/lib/with-timeout";
import { requireAuth, getOrganizationActorName } from "@/lib/auth";
import { GenerateMaintenanceButton } from "@/components/generate-maintenance-button";
import { SearchTrigger } from "@/components/search-trigger";
import { DashboardStatRow } from "@/components/dashboard-stat-row";
import { DashboardActionQueue } from "@/components/dashboard-action-queue";
import { DashboardActiveProjects } from "@/components/dashboard-active-projects";
import { DashboardWaitingOnClient } from "@/components/dashboard-waiting-on-client";
import { DashboardBlockers } from "@/components/dashboard-blockers";
import { DashboardReadyToLaunch } from "@/components/dashboard-ready-to-launch";
import { DashboardRecentActivity } from "@/components/dashboard-recent-activity";
import { DashboardCommandCenterData } from "@/components/dashboard-command-center-data";
import { DashboardOnboarding } from "@/components/dashboard-onboarding";
import { NotificationsBell } from "@/components/notifications-bell";
import { DashboardWelcomeBanner } from "@/components/dashboard-welcome-banner";
import { DashboardQuickActionsCard } from "@/components/dashboard-quick-actions-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function CommandCenterSkeleton() {
  return (
    <div className="app-card animate-pulse space-y-4 p-4">
      <div className="h-5 w-2/3 rounded bg-black/5" />
      <div className="h-24 rounded bg-black/5" />
      <div className="h-16 rounded bg-black/5" />
      <div className="h-32 rounded bg-black/5" />
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string }>;
}) {
  const { organizationId } = await requireAuth();
  const { panel } = await searchParams;
  // No explicit ?panel= in the URL (e.g. a plain /dashboard link from the
  // sidebar or another page) falls back to whichever project was last
  // pinned, remembered via a cookie set by DashboardPanelProjectPicker —
  // otherwise every navigation away and back reset to Auto regardless of
  // what was chosen.
  const cookieStore = await cookies();
  const resolvedPanel = panel ?? cookieStore.get("dashboard_panel")?.value ?? undefined;

  // Fault-tolerant on its own, separate from the main query group below —
  // a failure here (tech badges, panel picker, the greeting's name)
  // shouldn't take down the rest of the dashboard's real data. Started
  // immediately (not awaited yet) alongside the main group rather than
  // before it, so the two groups' round-trips overlap instead of adding
  // up serially — this was previously two sequential `await`s, each
  // paying its own full round-trip time back-to-back even though neither
  // depends on the other's result.
  const switcherPromise = withTimeout(
    Promise.all([listProjectsForSwitcher(organizationId), getOrganizationActorName(organizationId)]),
    5000,
    "project switcher"
  ).catch(() => null);

  const mainPromise = withTimeout(
    Promise.all([
      listProjects(organizationId),
      listAllTasks(organizationId),
      listRecentActivityAcrossProjects(organizationId, 16),
      listDueMaintenancePlans(organizationId),
    ]),
    8000,
    "dashboard top queries"
  );

  const [switcherResult, [projects, allTasks, activity, duePlans]] = await Promise.all([
    switcherPromise,
    mainPromise,
  ]);
  const switcherProjects: Awaited<ReturnType<typeof listProjectsForSwitcher>> = switcherResult?.[0] ?? [];
  const ownerName = switcherResult?.[1] ?? "there";

  const activeProjects = projects.filter((p) => p.status === "ACTIVE");
  const topLevelTasks = allTasks.filter((t) => !t.parentTaskId);

  const actionQueue = deriveActionQueue(allTasks);
  const waitingOnClient = deriveWaitingOnClient(allTasks);
  const blockedProjects = deriveBlockedProjects(allTasks);
  const readyToLaunch = deriveReadyToLaunch(allTasks);
  const launchRanking = deriveLaunchReadinessRanking(allTasks);
  const overdueLaunches = deriveOverdueLaunches(allTasks, projects);
  const clientActivity = activity.filter(isClientActivity);

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
  const isAuto = !resolvedPanel;
  const featuredProjectId = resolvedPanel ?? launchRanking[0]?.projectId ?? projects[0]?.id ?? null;

  return (
    // No color/bleed trick needed here anymore — <main> in the shared
    // layout now carries #FDFDFE directly, which covers its full box
    // (padding and scrollbar gutter included) with no seam.
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <SearchTrigger className="mb-0 w-64" placeholder="Search projects, tasks, SOPs…" />
          <NotificationsBell activity={clientActivity} />
          <Link
            href="/projects/new"
            className="shrink-0 rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            + New Project
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <DashboardOnboarding ownerName={ownerName} />
      ) : (
      <>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-[3fr_2fr]">
        <DashboardWelcomeBanner ownerName={ownerName} actionQueueCount={actionQueue.length} />
        <DashboardQuickActionsCard />
      </div>
      <div className="flex w-full items-start gap-4">
        <div className="min-w-0 flex-1">
          <DashboardStatRow
            activeProjectsCount={activeProjects.length}
            actionQueueCount={actionQueue.length}
            waitingOnClientCount={waitingOnClient.length}
            readyToLaunchCount={readyToLaunch.length}
          />

          {overdueLaunches.length > 0 && (
            <Card size="sm" className="mb-4 border-[#f3d4d4] bg-[#fdf5f5]">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-[#d03b3b]">Launch overdue</CardTitle>
              </CardHeader>
              <CardContent>
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
                        className="shrink-0 rounded-md border border-black/15 bg-white px-2.5 py-1.5 text-xs font-semibold text-link hover:bg-muted"
                      >
                        View checklist
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {duePlans.length > 0 && (
            <Card size="sm" className="mb-4 bg-[#fef4de]">
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-[#8a5c00]">Maintenance due</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
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
          <Suspense fallback={<CommandCenterSkeleton />}>
            <DashboardCommandCenterData
              featuredProjectId={featuredProjectId}
              organizationId={organizationId}
              switcherProjects={switcherProjects}
              isAuto={isAuto}
            />
          </Suspense>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
