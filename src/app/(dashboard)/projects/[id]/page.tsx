import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getProjectDetail,
  getProjectIssues,
  listRecentActivity,
  listProjectAttachmentsWithUrls,
  getLastHandoffView,
  listProjectMessages,
  type ProjectPulseSummary,
} from "@/lib/queries/projects";
import { listAccessItems } from "@/lib/queries/access-items";
import { listMaintenancePlansForProject } from "@/lib/queries/maintenance";
import { withTimeout } from "@/lib/with-timeout";
import { ProjectOverviewForm } from "@/components/project-overview-form";
import { AccessItemsPanel } from "@/components/access-items-panel";
import { ProjectHeader } from "@/components/project-header";
import { ProjectPulseCards } from "@/components/project-pulse-cards";
import { HandoffLinkPanel } from "@/components/handoff-link-panel";
import { ProjectTimeline } from "@/components/project-timeline";
import { NextActionsCard } from "@/components/next-actions-card";
import { LaunchChecklistCard } from "@/components/launch-checklist-card";
import { LaunchChecklistDetail } from "@/components/launch-checklist-detail";
import { RecentActivityCard } from "@/components/recent-activity-card";
import { WaitingOnClientCard } from "@/components/waiting-on-client-card";
import { ProjectTabs } from "@/components/project-tabs";
import { TaskStageBoard } from "@/components/task-stage-board";
import { FilesTab } from "@/components/files-tab";
import { NotesTab } from "@/components/notes-tab";
import { ActivityTab } from "@/components/activity-tab";
import { SettingsTab } from "@/components/settings-tab";
import { MessagesTab } from "@/components/messages-tab";
import { STAGES } from "@/data/stages";

const PRIORITY_WEIGHT: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { id } = await params;
  const { filter } = await searchParams;
  const activeFilter: "waiting" | "blocked" | "critical" | "actionable" | null =
    filter === "waiting"
      ? "waiting"
      : filter === "blocked"
        ? "blocked"
        : filter === "critical"
          ? "critical"
          : filter === "actionable"
            ? "actionable"
            : null;
  const [
    detail,
    accessItems,
    issues,
    recentActivity,
    fullActivity,
    projectFiles,
    maintenancePlans,
    lastHandoffView,
    messages,
  ] = await withTimeout(
    Promise.all([
      getProjectDetail(id),
      listAccessItems(id),
      getProjectIssues(id),
      listRecentActivity(id, 3),
      listRecentActivity(id, 500),
      listProjectAttachmentsWithUrls(id),
      listMaintenancePlansForProject(id),
      getLastHandoffView(id),
      listProjectMessages(id),
    ]),
    8000,
    "project detail page queries"
  );
  if (!detail) notFound();

  const { project, client, stages, technologies } = detail;
  // Task attachments are NOT resolved to signed URLs here anymore — that
  // used to block the whole page on one Supabase Storage API call per
  // attachment across every task in the project (real, measured cause of
  // slow/unreachable page loads on projects with many attachments). The
  // task board only ever needs the *count* (for the ✓ VERIFIED badge);
  // the actual signed URL is only needed once someone opens that specific
  // task's details modal, where it's now resolved on demand — see
  // resolveAttachmentUrlsAction in task-details.tsx.
  const tasks = detail.tasks;
  const tasksByStage = new Map<string, typeof tasks>();
  for (const stage of stages) tasksByStage.set(stage.id, []);
  for (const task of tasks) {
    if (task.parentTaskId) continue; // subtasks render nested under their parent
    tasksByStage.get(task.stageId)?.push(task);
  }
  const subtasksByParent = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.parentTaskId) continue;
    if (!subtasksByParent.has(task.parentTaskId)) subtasksByParent.set(task.parentTaskId, []);
    subtasksByParent.get(task.parentTaskId)!.push(task);
  }

  const criticalTasks = tasks.filter((t) => t.isCritical);
  const criticalDone = criticalTasks.filter((t) => t.effectiveStatus === "DONE").length;
  const launchReady = criticalTasks.length > 0 && criticalDone === criticalTasks.length;
  const criticalTasksWithStage = criticalTasks.map((t) => ({
    id: t.id,
    title: t.title,
    effectiveStatus: t.effectiveStatus,
    stageName: stages.find((s) => s.id === t.stageId)?.name ?? "",
  }));

  // --- Header stats ---
  const daysToLaunch = project.targetLaunchDate
    ? Math.round((new Date(project.targetLaunchDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null;
  const topLevelTasks = tasks.filter((t) => !t.parentTaskId);
  const tasksDone = topLevelTasks.filter((t) => t.effectiveStatus === "DONE").length;
  const tasksTotal = topLevelTasks.length;

  // --- Timeline: derived from existing stages/tasks, no new data model ---
  const timelineStages = stages
    .map((stage) => {
      const stageTasks = tasks.filter((t) => t.stageId === stage.id);
      const done = stageTasks.length > 0 && stageTasks.every((t) => t.effectiveStatus === "DONE" || t.effectiveStatus === "SKIPPED");
      return { id: stage.id, name: stage.name, taskCount: stageTasks.length, done };
    })
    .filter((s) => s.taskCount > 0);
  const firstIncompleteIndex = timelineStages.findIndex((s) => !s.done);
  const timelineWithStatus = timelineStages.map((s, i) => ({
    id: s.id,
    name: s.name,
    status: (s.done ? "done" : i === firstIncompleteIndex ? "current" : "pending") as "done" | "current" | "pending",
  }));
  const currentStage = timelineWithStatus.find((s) => s.status === "current");
  // Includes subtasks, matching the same task set the "current" determination
  // above is based on — a top-level-only count could disagree with it.
  const currentStageTasksAll = currentStage ? tasks.filter((t) => t.stageId === currentStage.id) : [];
  const currentStageDone = currentStageTasksAll.filter(
    (t) => t.effectiveStatus === "DONE" || t.effectiveStatus === "SKIPPED"
  ).length;
  const milestoneName = currentStage ? currentStage.name : timelineWithStatus.length > 0 ? "All stages complete" : null;
  const milestonePercent = currentStage
    ? currentStageTasksAll.length > 0
      ? Math.round((currentStageDone / currentStageTasksAll.length) * 100)
      : 0
    : timelineWithStatus.length > 0
      ? 100
      : null;

  // This project's own tasks flagged "waiting on client" — most recently
  // flagged first, same "done tasks never count as waiting" rule the
  // dashboard's cross-project version uses, just scoped to this one
  // project (and not deduped to one-per-project like the dashboard rollup is).
  // QA-stage tasks link to the QA tab, Launch/Handoff/Post-Launch-stage
  // tasks link to the Launch tab — both are separate tabs from the rest of
  // the board, each with its own filtered view below.
  const qaStageIdSet = new Set(stages.filter((s) => s.key === "qa").map((s) => s.id));
  const launchStageIdSet = new Set(
    stages.filter((s) => s.key === "launch" || s.key === "handoff" || s.key === "post_launch").map((s) => s.id)
  );
  const tabSlugForStage = (stageId: string): "tasks" | "qa" | "launch" =>
    qaStageIdSet.has(stageId) ? "qa" : launchStageIdSet.has(stageId) ? "launch" : "tasks";
  const waitingOnClientTasks = topLevelTasks
    .filter((t) => t.isWaitingOnClient && t.effectiveStatus !== "DONE" && t.effectiveStatus !== "SKIPPED")
    .sort((a, b) => {
      const aTime = a.waitingOnClientSince ? new Date(a.waitingOnClientSince).getTime() : 0;
      const bTime = b.waitingOnClientSince ? new Date(b.waitingOnClientSince).getTime() : 0;
      return bTime - aTime;
    })
    .map((t) => ({
      id: t.id,
      title: t.title,
      waitingOnClientSince: t.waitingOnClientSince,
      tabSlug: tabSlugForStage(t.stageId),
    }));

  const pulseSummary: ProjectPulseSummary = {
    id: project.id,
    name: project.name,
    clientName: client?.name ?? "—",
    healthScore: detail.healthScore,
    tasksDone,
    tasksTotal,
    issues: issues.map((i) => ({ id: i.id, message: i.message })),
    milestoneName,
    milestonePercent,
    daysToLaunch,
  };

  // --- Next actions: this project's actionable top-level tasks, same ranking as the dashboard's cross-project version ---
  const actionableTasks = topLevelTasks.filter(
    (t) => t.effectiveStatus !== "DONE" && t.effectiveStatus !== "SKIPPED" && t.effectiveStatus !== "BLOCKED"
  );
  const nextActions = [...actionableTasks]
    .sort((a, b) => {
      if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
      return (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9);
    })
    .slice(0, 3)
    .map((t) => ({
      id: t.id,
      title: t.title,
      isCritical: t.isCritical,
      priority: t.priority,
      stageName: stages.find((s) => s.id === t.stageId)?.name ?? "",
    }));
  // "View tasks" defaults to the Tasks tab, but only if it actually has an
  // actionable task — same reasoning as the Waiting On Client card's
  // "View all", so it never lands on a tab that's structurally empty.
  const nextActionsTabSlug: "tasks" | "qa" | "launch" = actionableTasks.some(
    (t) => !qaStageIdSet.has(t.stageId) && !launchStageIdSet.has(t.stageId)
  )
    ? "tasks"
    : actionableTasks.some((t) => qaStageIdSet.has(t.stageId))
      ? "qa"
      : "launch";

  const commandCenterContent = (
    <>
      <div className="mb-4">
        <ProjectTimeline stages={timelineWithStatus} />
      </div>

      <div className="mb-4">
        <ProjectPulseCards summary={pulseSummary} />
      </div>

      <div className="mb-4 grid grid-cols-1 items-stretch gap-3 lg:grid-cols-3">
        <div className="flex h-full flex-col gap-3">
          <NextActionsCard projectId={project.id} tasks={nextActions} viewAllTabSlug={nextActionsTabSlug} />
          <ProjectOverviewForm
            projectId={project.id}
            domain={project.domain}
            targetLaunchDate={project.targetLaunchDate}
            daysToLaunch={daysToLaunch}
            healthScore={detail.healthScore}
            healthUpdatedAt={project.updatedAt}
            tasksDone={tasksDone}
            tasksTotal={tasksTotal}
            lastActivityAt={recentActivity[0]?.createdAt ?? null}
            lastActivityActor={recentActivity[0]?.actorName ?? null}
          />
          <div className="flex-1">
            <RecentActivityCard projectId={project.id} activity={recentActivity} />
          </div>
        </div>
        <div className="flex h-full flex-col gap-3">
          <div className="shrink-0">
            <WaitingOnClientCard projectId={project.id} tasks={waitingOnClientTasks} />
          </div>
          <div className="min-h-0 flex-1">
            <AccessItemsPanel projectId={project.id} items={accessItems} />
          </div>
        </div>
        <div className="flex h-full flex-col gap-3">
          <div className="flex-1">
            <LaunchChecklistCard projectId={project.id} tasks={criticalTasksWithStage} />
          </div>
          <HandoffLinkPanel projectId={project.id} token={project.handoffToken} lastViewedAt={lastHandoffView} />
        </div>
      </div>
    </>
  );

  // "Tasks" is scoped to what's actually being built — QA and Launch/
  // Handoff/Post-Launch each get their own tab so neither reads as "one
  // more build task" mixed into the same list.
  const buildStages = stages.filter((s) => !qaStageIdSet.has(s.id) && !launchStageIdSet.has(s.id));
  const qaStages = stages.filter((s) => qaStageIdSet.has(s.id));
  const launchStages = stages.filter((s) => launchStageIdSet.has(s.id));
  const openTopLevel = (stageIds: Set<string>) =>
    topLevelTasks.filter(
      (t) => stageIds.has(t.stageId) && t.effectiveStatus !== "DONE" && t.effectiveStatus !== "SKIPPED"
    ).length;
  const buildTasksRemaining = openTopLevel(new Set(buildStages.map((s) => s.id)));
  const qaTaskCount = openTopLevel(new Set(qaStages.map((s) => s.id)));
  const launchTaskCount = openTopLevel(new Set(launchStages.map((s) => s.id)));

  // Filtered board views — linked here from the dashboard/Command Center's
  // Waiting On Client, Action Queue, and Blockers cards so a click actually
  // lands on a real, scoped list instead of just the unfiltered board.
  const waitingTasksByStage = new Map<string, typeof tasks>();
  const blockedTasksByStage = new Map<string, typeof tasks>();
  const criticalTasksByStage = new Map<string, typeof tasks>();
  const actionableTasksByStage = new Map<string, typeof tasks>();
  for (const [stageId, stageTasks] of tasksByStage) {
    waitingTasksByStage.set(
      stageId,
      stageTasks.filter((t) => t.isWaitingOnClient && t.effectiveStatus !== "DONE" && t.effectiveStatus !== "SKIPPED")
    );
    blockedTasksByStage.set(
      stageId,
      stageTasks.filter((t) => t.effectiveStatus === "BLOCKED")
    );
    criticalTasksByStage.set(
      stageId,
      stageTasks.filter((t) => t.isCritical && t.effectiveStatus !== "DONE" && t.effectiveStatus !== "SKIPPED")
    );
    // Same "actionable" definition as the Next Actions card itself uses —
    // not done, not skipped, not blocked — so "View tasks" shows exactly
    // the pool that card is drawing its top-3 picks from, with every
    // task's real priority (Critical/High/Medium/Low) visible on the row.
    actionableTasksByStage.set(
      stageId,
      stageTasks.filter(
        (t) => t.effectiveStatus !== "DONE" && t.effectiveStatus !== "SKIPPED" && t.effectiveStatus !== "BLOCKED"
      )
    );
  }
  const FILTERED_BOARDS: Record<"waiting" | "blocked" | "critical" | "actionable", Map<string, typeof tasks>> = {
    waiting: waitingTasksByStage,
    blocked: blockedTasksByStage,
    critical: criticalTasksByStage,
    actionable: actionableTasksByStage,
  };
  const filteredTasksByStage = activeFilter ? FILTERED_BOARDS[activeFilter] : tasksByStage;
  const FILTER_EMPTY_TEXT: Record<"waiting" | "blocked" | "critical" | "actionable", string> = {
    waiting: "No tasks here are currently waiting on the client.",
    blocked: "No tasks here are currently blocked.",
    critical: "No tasks here are currently marked critical.",
    actionable: "Nothing actionable here right now.",
  };
  const FILTER_BANNER_TEXT: Record<"waiting" | "blocked" | "critical" | "actionable", string> = {
    waiting: "Showing only tasks waiting on the client.",
    blocked: "Showing only blocked tasks.",
    critical: "Showing only critical tasks.",
    actionable: "Showing only actionable tasks — not done, skipped, or blocked.",
  };
  // Landing here via a filtered link (a Command Center card, the header's
  // Filter menu) should say so — the picker itself now lives in the
  // header, but a banner here still tells you what you're looking at and
  // gives a one-click way back, without needing to reopen that menu.
  const filterBanner = (tabSlug: "tasks" | "qa" | "launch") =>
    activeFilter && (
      <div className="app-card mb-4 flex items-center justify-between gap-2 border-[#f5e3b3] bg-[#fef4de] p-3 text-sm text-[#8a5c00]">
        <span>{FILTER_BANNER_TEXT[activeFilter]}</span>
        <Link
          href={`/projects/${project.id}?tab=${tabSlug}`}
          className="shrink-0 rounded-md border border-[#f5e3b3] bg-white px-2.5 py-1 text-xs font-semibold text-[#8a5c00] hover:bg-[#fdeac3]"
        >
          Clear filter
        </Link>
      </div>
    );

  // Task filtering lives in the persistent page header, next to "+ New
  // Task" — the exact same precedent that button already set (Tasks/QA/
  // Launch-specific functionality that lives in the header rather than
  // inside any one tab's body, so it's reachable from anywhere, not just
  // when already looking at a board). Each option resolves its own
  // tabSlug — "tasks" if any match is build-stage, else "qa" if any match
  // is QA-stage, else "launch" — so picking a filter never lands on a tab
  // that structurally can't show the result.
  const countAll = (map: Map<string, typeof tasks>) =>
    Array.from(map.values()).reduce((sum, arr) => sum + arr.length, 0);
  const tabSlugForFilter = (map: Map<string, typeof tasks>): "tasks" | "qa" | "launch" => {
    const entries = Array.from(map.entries()).filter(([, arr]) => arr.length > 0);
    if (entries.some(([stageId]) => !qaStageIdSet.has(stageId) && !launchStageIdSet.has(stageId))) return "tasks";
    if (entries.some(([stageId]) => qaStageIdSet.has(stageId))) return "qa";
    return "launch";
  };

  const taskFilterOptions: { key: "waiting" | "blocked" | "critical" | "actionable"; label: string; count: number; tabSlug: "tasks" | "qa" | "launch" }[] = [
    { key: "actionable", label: "Actionable", count: countAll(actionableTasksByStage), tabSlug: tabSlugForFilter(actionableTasksByStage) },
    { key: "critical", label: "Critical", count: countAll(criticalTasksByStage), tabSlug: tabSlugForFilter(criticalTasksByStage) },
    { key: "blocked", label: "Blocked", count: countAll(blockedTasksByStage), tabSlug: tabSlugForFilter(blockedTasksByStage) },
    { key: "waiting", label: "Waiting", count: countAll(waitingTasksByStage), tabSlug: tabSlugForFilter(waitingTasksByStage) },
  ];

  const filteredTasksCount = buildStages.reduce((sum, s) => sum + (filteredTasksByStage.get(s.id)?.length ?? 0), 0);
  const filteredQaCount = qaStages.reduce((sum, s) => sum + (filteredTasksByStage.get(s.id)?.length ?? 0), 0);
  const filteredLaunchCount = launchStages.reduce((sum, s) => sum + (filteredTasksByStage.get(s.id)?.length ?? 0), 0);

  const tasksContent = (
    <>
      {filterBanner("tasks")}
      {activeFilter && filteredTasksCount === 0 ? (
        <p className="text-sm text-muted-foreground">{FILTER_EMPTY_TEXT[activeFilter]}</p>
      ) : (
        <TaskStageBoard stages={buildStages} tasksByStage={filteredTasksByStage} subtasksByParent={subtasksByParent} />
      )}
    </>
  );

  const qaContent = (
    <>
      {filterBanner("qa")}
      {qaStages.length === 0 || filteredQaCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          {activeFilter ? FILTER_EMPTY_TEXT[activeFilter] : "No QA tasks yet — they land here once the QA stage has any."}
        </p>
      ) : (
        <TaskStageBoard stages={qaStages} tasksByStage={filteredTasksByStage} subtasksByParent={subtasksByParent} />
      )}
    </>
  );

  // Launch/Handoff/Post-Launch get their own tab next to QA rather than
  // living inside Tasks — Tasks is deliberately scoped to build-stage work
  // only (see buildStages above), and these late-project stages never fit
  // that scope cleanly. The critical-only checklist stays on top for an
  // at-a-glance readiness view; the full board below it covers every
  // priority, same as Tasks/QA.
  const launchContent = (
    <>
      {filterBanner("launch")}
      {!activeFilter && <LaunchChecklistDetail tasks={criticalTasksWithStage} />}
      {launchStages.length === 0 || filteredLaunchCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          {activeFilter ? FILTER_EMPTY_TEXT[activeFilter] : "No launch-stage tasks yet."}
        </p>
      ) : (
        <TaskStageBoard stages={launchStages} tasksByStage={filteredTasksByStage} subtasksByParent={subtasksByParent} />
      )}
    </>
  );

  const filesContent = <FilesTab projectId={project.id} files={projectFiles} />;
  const messagesContent = <MessagesTab projectId={project.id} messages={messages} />;
  const clientActivityContent = (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr] lg:items-start">
      <div>{filesContent}</div>
      <div>{messagesContent}</div>
    </div>
  );
  const notesContent = <NotesTab projectId={project.id} notes={project.notes} />;
  const activityTabContent = <ActivityTab activity={fullActivity} />;
  const settingsContent = (
    <SettingsTab
      projectId={project.id}
      projectName={project.name}
      clientName={client?.name ?? ""}
      technologies={technologies}
      maintenancePlans={maintenancePlans}
    />
  );

  return (
    <div className="w-full">
      <ProjectHeader
        projectId={project.id}
        projectName={project.name}
        projectType={project.projectType}
        status={project.status}
        clientId={client?.id ?? ""}
        clientName={client?.name ?? "—"}
        handoffToken={project.handoffToken}
        launchedAt={project.launchedAt}
        launchReady={launchReady}
        healthScore={detail.healthScore}
        stages={STAGES}
        technologies={technologies}
        activeTaskFilter={activeFilter}
        taskFilterOptions={taskFilterOptions}
        allTasksCount={topLevelTasks.length}
      />

      <Suspense fallback={null}>
        <ProjectTabs
          tabs={[
            { label: "Command Center", slug: "command-center", content: commandCenterContent },
            { label: "Tasks", slug: "tasks", badge: buildTasksRemaining, content: tasksContent },
            { label: "QA", slug: "qa", badge: qaTaskCount, content: qaContent },
            { label: "Launch", slug: "launch", badge: launchTaskCount, content: launchContent },
            {
              label: "Client Activity",
              slug: "client-activity",
              badge: projectFiles.length + messages.length || undefined,
              notifyUrl: [`/api/projects/${project.id}/files`, `/api/projects/${project.id}/messages`],
              content: clientActivityContent,
            },
            { label: "Notes", slug: "notes", content: notesContent },
            { label: "Activity", slug: "activity", content: activityTabContent },
            { label: "Settings", slug: "settings", content: settingsContent },
          ]}
        />
      </Suspense>
    </div>
  );
}
