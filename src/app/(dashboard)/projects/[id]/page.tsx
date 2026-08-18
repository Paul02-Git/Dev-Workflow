import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  getProjectDetail,
  getProjectIssues,
  listRecentActivity,
  listWaitingOnClientTasks,
  listProjectAttachments,
  getLastHandoffView,
  type ProjectPulseSummary,
} from "@/lib/queries/projects";
import { listAccessItems } from "@/lib/queries/access-items";
import { listMaintenancePlansForProject } from "@/lib/queries/maintenance";
import { getSignedAttachmentUrl } from "@/lib/storage";
import { ProjectOverviewForm } from "@/components/project-overview-form";
import { AccessItemsPanel } from "@/components/access-items-panel";
import { ProjectHeader } from "@/components/project-header";
import { ProjectPulseCards } from "@/components/project-pulse-cards";
import { HandoffLinkPanel } from "@/components/handoff-link-panel";
import { ProjectTimeline } from "@/components/project-timeline";
import { NextActionsCard } from "@/components/next-actions-card";
import { LaunchChecklistCard } from "@/components/launch-checklist-card";
import { LaunchChecklistDetail } from "@/components/launch-checklist-detail";
import { WaitingOnClientCard } from "@/components/waiting-on-client-card";
import { RecentActivityCard } from "@/components/recent-activity-card";
import { ProjectTabs } from "@/components/project-tabs";
import { TaskStageBoard } from "@/components/task-stage-board";
import { FilesTab } from "@/components/files-tab";
import { NotesTab } from "@/components/notes-tab";
import { ActivityTab } from "@/components/activity-tab";
import { SettingsTab } from "@/components/settings-tab";
import { STAGES } from "@/data/stages";

const PRIORITY_WEIGHT: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [
    detail,
    accessItems,
    issues,
    recentActivity,
    fullActivity,
    waitingOnClientTasks,
    allFiles,
    maintenancePlans,
    lastHandoffView,
  ] = await Promise.all([
    getProjectDetail(id),
    listAccessItems(id),
    getProjectIssues(id),
    listRecentActivity(id, 3),
    listRecentActivity(id, 500),
    listWaitingOnClientTasks(id),
    listProjectAttachments(id),
    listMaintenancePlansForProject(id),
    getLastHandoffView(id),
  ]);
  if (!detail) notFound();

  const { project, client, stages, technologies } = detail;
  // Uploaded files live in a private bucket — resolve each to a fresh
  // signed URL (1hr expiry) at render time; pasted external links pass through.
  const tasks = await Promise.all(
    detail.tasks.map(async (t) => ({
      ...t,
      attachments: await Promise.all(
        t.attachments.map(async (a) => ({
          ...a,
          url: a.storagePath ? await getSignedAttachmentUrl(a.storagePath) : a.url,
        }))
      ),
    }))
  );
  const projectFiles = await Promise.all(
    allFiles.map(async (f) => ({
      ...f,
      url: f.storagePath ? await getSignedAttachmentUrl(f.storagePath) : f.url,
    }))
  );
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
  const nextActions = topLevelTasks
    .filter((t) => t.effectiveStatus !== "DONE" && t.effectiveStatus !== "SKIPPED" && t.effectiveStatus !== "BLOCKED")
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
          <NextActionsCard projectId={project.id} tasks={nextActions} />
          <div className="flex-1">
            <RecentActivityCard projectId={project.id} activity={recentActivity} />
          </div>
        </div>
        <AccessItemsPanel projectId={project.id} items={accessItems} />
        <div className="flex h-full flex-col gap-3">
          <div className="flex-1">
            <LaunchChecklistCard projectId={project.id} tasks={criticalTasksWithStage} />
          </div>
          <HandoffLinkPanel projectId={project.id} token={project.handoffToken} lastViewedAt={lastHandoffView} />
        </div>
      </div>

      <WaitingOnClientCard tasks={waitingOnClientTasks} />
    </>
  );

  // "Tasks" is scoped to what's actually being built — QA gets its own tab
  // so it doesn't read as "one more build task" mixed into the same list.
  const buildStages = stages.filter((s) => s.key !== "qa");
  const qaStages = stages.filter((s) => s.key === "qa");
  const openTopLevel = (stageIds: Set<string>) =>
    topLevelTasks.filter(
      (t) => stageIds.has(t.stageId) && t.effectiveStatus !== "DONE" && t.effectiveStatus !== "SKIPPED"
    ).length;
  const buildTasksRemaining = openTopLevel(new Set(buildStages.map((s) => s.id)));
  const qaTaskCount = openTopLevel(new Set(qaStages.map((s) => s.id)));

  const tasksContent = (
    <>
      <LaunchChecklistDetail tasks={criticalTasksWithStage} />
      <TaskStageBoard stages={buildStages} tasksByStage={tasksByStage} subtasksByParent={subtasksByParent} />
    </>
  );

  const qaContent =
    qaStages.length === 0 || (tasksByStage.get(qaStages[0].id) ?? []).length === 0 ? (
      <p className="text-sm text-muted-foreground">No QA tasks yet — they land here once the QA stage has any.</p>
    ) : (
      <TaskStageBoard stages={qaStages} tasksByStage={tasksByStage} subtasksByParent={subtasksByParent} />
    );

  const filesContent = <FilesTab projectId={project.id} files={projectFiles} />;
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
      />

      <Suspense fallback={null}>
        <ProjectTabs
          tabs={[
            { label: "Command Center", slug: "command-center", content: commandCenterContent },
            { label: "Tasks", slug: "tasks", badge: buildTasksRemaining, content: tasksContent },
            { label: "QA", slug: "qa", badge: qaTaskCount, content: qaContent },
            { label: "Files", slug: "files", badge: projectFiles.length || undefined, content: filesContent },
            { label: "Notes", slug: "notes", content: notesContent },
            { label: "Activity", slug: "activity", content: activityTabContent },
            { label: "Settings", slug: "settings", content: settingsContent },
          ]}
        />
      </Suspense>
    </div>
  );
}
