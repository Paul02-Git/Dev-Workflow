import { db } from "@/db/client";
import {
  projects,
  clients,
  stages,
  technologies,
  projectTechnologies,
  projectStages,
  tasks,
  taskDependencies,
  activityLogs,
  tags,
  taskTags,
  attachments,
  accessItems,
} from "@/db/schema";
import { eq, desc, inArray, and, or, isNull, sql, ne } from "drizzle-orm";
import { randomBytes } from "crypto";
import { deleteStorageObjects } from "@/lib/storage";
import { generateWorkflow } from "@/lib/workflow-engine/generate-workflow";
import { computeEffectiveStatuses } from "@/lib/workflow-engine/blocked-status";
import { computeHealthScore } from "@/lib/health/health-score";
import { checkProject, type TaskLookup } from "@/lib/health/forgotten-task-rules";
import { accessItemPresetsForTechnologies } from "@/data/access-item-presets";
import { CLIENT_ACTION_CANONICAL_KEYS } from "@/data/client-action-keys";
import { AGENCY_OWNER_NAME, CLIENT_ACTOR_NAME } from "@/data/agency-info";

export async function listProjects() {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      projectType: projects.projectType,
      status: projects.status,
      healthScore: projects.healthScore,
      launchReady: projects.launchReady,
      createdAt: projects.createdAt,
      clientId: clients.id,
      clientName: clients.name,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .orderBy(desc(projects.createdAt));
  return rows;
}

/**
 * Every project with its client and the technology names it uses —
 * backs the sidebar's project switcher (name + client + a small stack of
 * technology logos). Deliberately lighter than `listProjects()`'s
 * consumers need — no health score or dates, just enough to render a
 * dropdown row and navigate.
 */
export async function listProjectsForSwitcher() {
  const [projectRows, techRows] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        clientName: clients.name,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .orderBy(desc(projects.createdAt)),
    db
      .select({
        projectId: projectTechnologies.projectId,
        technologyName: technologies.name,
      })
      .from(projectTechnologies)
      .innerJoin(technologies, eq(projectTechnologies.technologyId, technologies.id)),
  ]);

  const techNamesByProject = new Map<string, string[]>();
  for (const r of techRows) {
    if (!techNamesByProject.has(r.projectId)) techNamesByProject.set(r.projectId, []);
    techNamesByProject.get(r.projectId)!.push(r.technologyName);
  }

  return projectRows.map((p) => ({ ...p, technologyNames: techNamesByProject.get(p.id) ?? [] }));
}

/**
 * Deletes a project and everything under it. All child tables (tasks,
 * project_stages, project_technologies, access_items, activity_logs, and
 * task_dependencies/tags/attachments transitively via tasks) reference
 * projects.id with ON DELETE CASCADE, so one delete here is sufficient.
 */
export async function deleteProject(id: string) {
  await db.delete(projects).where(eq(projects.id, id));
}

/**
 * Sets project status. Stamps launchedAt the first time status becomes
 * LAUNCHED (never overwrites or clears it on later transitions — moving to
 * ON_HOLD or ARCHIVED after launch shouldn't erase the historical launch
 * date).
 */
export async function updateProjectStatus(projectId: string, status: string) {
  const [current] = await db.select({ launchedAt: projects.launchedAt }).from(projects).where(eq(projects.id, projectId));
  const shouldStampLaunch = status === "LAUNCHED" && !current?.launchedAt;

  const [project] = await db
    .update(projects)
    .set({
      status: status as (typeof projects.$inferInsert)["status"],
      ...(shouldStampLaunch ? { launchedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  await db.insert(activityLogs).values({
    projectId,
    action: "project_status_changed",
    detail: status,
    actorName: AGENCY_OWNER_NAME,
  });

  return project;
}

export async function updateProjectOverview(
  projectId: string,
  input: { domain?: string | null; targetLaunchDate?: Date | null }
) {
  const [project] = await db
    .update(projects)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  return project;
}

/**
 * Technology adoption across active projects. Backs the Integrations page —
 * purely informational (which technologies are in use where), not a live
 * OAuth-synced integration; that's explicitly out of scope for now.
 */
export async function listTechnologyUsage() {
  const allTechnologies = await db.select().from(technologies);
  const rows = await db
    .select({
      technologyId: projectTechnologies.technologyId,
      projectId: projects.id,
      projectName: projects.name,
      projectStatus: projects.status,
    })
    .from(projectTechnologies)
    .innerJoin(projects, eq(projectTechnologies.projectId, projects.id));

  const projectsByTech = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!projectsByTech.has(r.technologyId)) projectsByTech.set(r.technologyId, []);
    projectsByTech.get(r.technologyId)!.push(r);
  }

  return allTechnologies.map((t) => ({
    ...t,
    projects: projectsByTech.get(t.id) ?? [],
  }));
}

/**
 * Creates a project and materializes its full workflow (stages, tasks,
 * dependencies) by running the technology selection through the workflow
 * engine. This is the "Generate Workflow" step of the project wizard.
 */
export async function createProjectWithWorkflow(input: {
  clientId: string;
  name: string;
  projectType: string;
  technologyKeys: string[];
}) {
  const plan = generateWorkflow(input.technologyKeys);

  const [allStages, allTechnologies] = await Promise.all([
    db.select().from(stages),
    db.select().from(technologies),
  ]);
  const stageIdByKey = new Map(allStages.map((s) => [s.key, s.id]));
  const techIdByKey = new Map(allTechnologies.map((t) => [t.key, t.id]));

  const selectedTechIds = input.technologyKeys
    .map((k) => techIdByKey.get(k))
    .filter((id): id is string => !!id);

  const [project] = await db
    .insert(projects)
    .values({
      clientId: input.clientId,
      name: input.name,
      projectType: input.projectType,
    })
    .returning();

  if (selectedTechIds.length > 0) {
    await db
      .insert(projectTechnologies)
      .values(selectedTechIds.map((technologyId) => ({ projectId: project.id, technologyId })));
  }

  if (plan.stages.length > 0) {
    await db.insert(projectStages).values(
      plan.stages.map((s) => ({
        projectId: project.id,
        stageId: stageIdByKey.get(s.stageKey)!,
        sortOrder: s.sortOrder,
      }))
    );
  }

  // Insert tasks, capturing canonicalKey -> new row id so dependency edges
  // (expressed by canonicalKey in the generated plan) can be resolved to
  // real foreign keys afterward.
  const canonicalKeyToTaskId = new Map<string, string>();
  if (plan.tasks.length > 0) {
    const insertedTasks = await db
      .insert(tasks)
      .values(
        plan.tasks.map((t) => ({
          projectId: project.id,
          stageId: stageIdByKey.get(t.stageKey)!,
          canonicalKey: t.canonicalKey,
          title: t.title,
          description: t.description,
          priority: t.priority,
          isCritical: t.isCritical,
          sortOrder: t.sortOrder,
        }))
      )
      .returning({ id: tasks.id, canonicalKey: tasks.canonicalKey });

    for (const row of insertedTasks) {
      if (row.canonicalKey) canonicalKeyToTaskId.set(row.canonicalKey, row.id);
    }

    // Subtasks: one real task row per subtask string, parented to its owner.
    // sortOrder is the subtask's index within its own parent's list — without
    // it every subtask defaults to 0, and Postgres has no tie-breaker, so an
    // UPDATE (e.g. marking one done) can silently reshuffle the return order
    // of the tied rows on the next query.
    const subtaskRows = plan.tasks.flatMap((t) =>
      t.subtasks.map((title, i) => ({
        projectId: project.id,
        stageId: stageIdByKey.get(t.stageKey)!,
        parentTaskId: canonicalKeyToTaskId.get(t.canonicalKey)!,
        title,
        priority: t.priority,
        sortOrder: i,
      }))
    );
    if (subtaskRows.length > 0) {
      await db.insert(tasks).values(subtaskRows);
    }
  }

  if (plan.dependencies.length > 0) {
    const depRows = plan.dependencies
      .map((d) => ({
        taskId: canonicalKeyToTaskId.get(d.taskCanonicalKey),
        dependsOnTaskId: canonicalKeyToTaskId.get(d.dependsOnCanonicalKey),
      }))
      .filter((d): d is { taskId: string; dependsOnTaskId: string } => !!d.taskId && !!d.dependsOnTaskId);
    if (depRows.length > 0) {
      await db.insert(taskDependencies).values(depRows);
    }
  }

  const accessPresets = accessItemPresetsForTechnologies(input.technologyKeys);
  if (accessPresets.length > 0) {
    await db.insert(accessItems).values(
      accessPresets.map((preset) => ({
        projectId: project.id,
        name: preset.name,
        role: preset.defaultRole,
        instructions: preset.instructions,
        // Every access item starts NOT_REQUESTED (the schema default),
        // even self_created ones (Cloudways, GA4, domain registrar...) —
        // Paul marks each one connected explicitly once it's actually set
        // up, rather than the app assuming it's already done on day one.
      }))
    );
  }

  await db.insert(activityLogs).values({
    projectId: project.id,
    action: "project_created",
    detail: `Generated ${plan.tasks.length} tasks across ${plan.stages.length} stages from: ${input.technologyKeys.join(", ")}`,
    actorName: AGENCY_OWNER_NAME,
  });

  return project;
}

export async function getProjectDetail(projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return null;

  const [client] = await db.select().from(clients).where(eq(clients.id, project.clientId));

  const projectStageRows = await db
    .select({ id: stages.id, key: stages.key, name: stages.name, sortOrder: projectStages.sortOrder })
    .from(projectStages)
    .innerJoin(stages, eq(projectStages.stageId, stages.id))
    .where(eq(projectStages.projectId, projectId))
    .orderBy(projectStages.sortOrder);

  const taskRows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(tasks.sortOrder);

  const taskIds = taskRows.map((t) => t.id);
  const depRows =
    taskIds.length > 0
      ? await db.select().from(taskDependencies).where(inArray(taskDependencies.taskId, taskIds))
      : [];

  const effective = computeEffectiveStatuses(
    taskRows.map((t) => ({ id: t.id, status: t.status })),
    depRows.map((d) => ({ taskId: d.taskId, dependsOnTaskId: d.dependsOnTaskId }))
  );

  const healthScore = computeHealthScore(
    taskRows.map((t) => ({ status: t.status, isCritical: t.isCritical, dueDate: t.dueDate })),
    taskRows.map((t) => effective.get(t.id) ?? t.status)
  );

  const [tagRows, attachmentRows] =
    taskIds.length > 0
      ? await Promise.all([
          db
            .select({ taskId: taskTags.taskId, tagId: tags.id, tagName: tags.name })
            .from(taskTags)
            .innerJoin(tags, eq(taskTags.tagId, tags.id))
            .where(inArray(taskTags.taskId, taskIds)),
          db.select().from(attachments).where(inArray(attachments.taskId, taskIds)),
        ])
      : [[], []];
  const techRows = await db
    .select({ name: technologies.name })
    .from(projectTechnologies)
    .innerJoin(technologies, eq(projectTechnologies.technologyId, technologies.id))
    .where(eq(projectTechnologies.projectId, projectId));

  const tagsByTask = new Map<string, { id: string; name: string }[]>();
  for (const r of tagRows) {
    if (!tagsByTask.has(r.taskId)) tagsByTask.set(r.taskId, []);
    tagsByTask.get(r.taskId)!.push({ id: r.tagId, name: r.tagName });
  }
  const attachmentsByTask = new Map<string, (typeof attachmentRows)[number][]>();
  for (const r of attachmentRows) {
    if (!r.taskId) continue; // this query only selected task-scoped attachments; guard keeps the map key type clean
    if (!attachmentsByTask.has(r.taskId)) attachmentsByTask.set(r.taskId, []);
    attachmentsByTask.get(r.taskId)!.push(r);
  }

  return {
    project,
    client,
    stages: projectStageRows,
    technologies: techRows.map((t) => t.name),
    tasks: taskRows.map((t) => ({
      ...t,
      effectiveStatus: effective.get(t.id) ?? t.status,
      tags: tagsByTask.get(t.id) ?? [],
      attachments: attachmentsByTask.get(t.id) ?? [],
    })),
    dependencies: depRows,
    healthScore,
  };
}

/**
 * The "Check Project" feature: runs the hand-written forgotten-task rules
 * against this project's actual task set.
 */
export async function getProjectIssues(projectId: string) {
  const detail = await getProjectDetail(projectId);
  if (!detail) return [];

  const byCanonicalKey = new Map(detail.tasks.filter((t) => t.canonicalKey).map((t) => [t.canonicalKey!, t]));
  const now = Date.now();

  const lookup: TaskLookup = {
    status: (canonicalKey) => byCanonicalKey.get(canonicalKey)?.status,
    daysSince: (canonicalKey) => {
      const task = byCanonicalKey.get(canonicalKey);
      if (!task) return null;
      const anchor = task.completedAt ?? detail.project.createdAt;
      return Math.floor((now - new Date(anchor).getTime()) / (1000 * 60 * 60 * 24));
    },
  };

  return checkProject(lookup);
}

export type ProjectPulseSummary = {
  id: string;
  name: string;
  clientName: string;
  healthScore: number;
  tasksDone: number;
  tasksTotal: number;
  issues: { id: string; message: string }[];
  milestoneName: string | null;
  milestonePercent: number | null;
  daysToLaunch: number | null;
};


export async function updateTaskStatus(taskId: string, status: string) {
  const completedAt = status === "DONE" ? new Date() : null;
  // A task marked Done can't still be "waiting on the client" — clear the
  // flag so it doesn't silently reappear in the Waiting On Client list if
  // the task is later reopened without being re-flagged.
  const waitingFields =
    status === "DONE" ? { isWaitingOnClient: false, waitingOnClientSince: null } : {};
  const [task] = await db
    .update(tasks)
    .set({
      status: status as (typeof tasks.$inferInsert)["status"],
      completedAt,
      updatedAt: new Date(),
      ...waitingFields,
    })
    .where(eq(tasks.id, taskId))
    .returning();

  if (task) {
    await db.insert(activityLogs).values({
      projectId: task.projectId,
      taskId: task.id,
      action: "task_status_changed",
      detail: status,
      actorName: AGENCY_OWNER_NAME,
    });

    // Recompute and persist the project's health score.
    const detail = await getProjectDetail(task.projectId);
    if (detail) {
      await db
        .update(projects)
        .set({ healthScore: detail.healthScore, updatedAt: new Date() })
        .where(eq(projects.id, task.projectId));
    }
  }

  return task;
}

/**
 * Same effect as updateTaskStatus, applied to many tasks at once (the
 * /tasks bulk-select bar). Returns the distinct set of affected project ids
 * so the caller knows which project pages to revalidate.
 */
export async function bulkUpdateTaskStatus(taskIds: string[], status: string): Promise<string[]> {
  if (taskIds.length === 0) return [];
  const completedAt = status === "DONE" ? new Date() : null;
  const waitingFields =
    status === "DONE" ? { isWaitingOnClient: false, waitingOnClientSince: null } : {};

  const updated = await db
    .update(tasks)
    .set({
      status: status as (typeof tasks.$inferInsert)["status"],
      completedAt,
      updatedAt: new Date(),
      ...waitingFields,
    })
    .where(inArray(tasks.id, taskIds))
    .returning({ id: tasks.id, projectId: tasks.projectId });

  if (updated.length === 0) return [];

  await db.insert(activityLogs).values(
    updated.map((t) => ({
      projectId: t.projectId,
      taskId: t.id,
      action: "task_status_changed",
      detail: status,
      actorName: AGENCY_OWNER_NAME,
    }))
  );

  const projectIds = [...new Set(updated.map((t) => t.projectId))];
  for (const projectId of projectIds) {
    const detail = await getProjectDetail(projectId);
    if (detail) {
      await db
        .update(projects)
        .set({ healthScore: detail.healthScore, updatedAt: new Date() })
        .where(eq(projects.id, projectId));
    }
  }

  return projectIds;
}

async function getTaskProjectId(taskId: string) {
  const [row] = await db.select({ projectId: tasks.projectId }).from(tasks).where(eq(tasks.id, taskId));
  return row?.projectId ?? null;
}

export async function updateTaskDetails(
  taskId: string,
  input: { notes?: string | null; dueDate?: Date | null; assignee?: string | null }
) {
  const [task] = await db
    .update(tasks)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();
  return task;
}

export async function addTaskTag(taskId: string, tagName: string) {
  const name = tagName.trim();
  if (!name) return getTaskProjectId(taskId);

  const [tag] = await db
    .insert(tags)
    .values({ name })
    .onConflictDoUpdate({ target: tags.name, set: { name } })
    .returning();
  await db.insert(taskTags).values({ taskId, tagId: tag.id }).onConflictDoNothing();
  return getTaskProjectId(taskId);
}

export async function removeTaskTag(taskId: string, tagId: string) {
  await db.delete(taskTags).where(and(eq(taskTags.taskId, taskId), eq(taskTags.tagId, tagId)));
  return getTaskProjectId(taskId);
}

export async function addTaskAttachment(taskId: string, input: { url: string; label?: string }) {
  const url = input.url.trim();
  if (!url) return getTaskProjectId(taskId);
  await db.insert(attachments).values({ taskId, url, label: input.label?.trim() || undefined });
  return getTaskProjectId(taskId);
}

/**
 * Handles both task-scoped and project-scoped attachments (exactly one of
 * taskId/projectId is set). Deletes the underlying Supabase Storage object
 * too when there is one (uploaded files, not pasted links) — otherwise a
 * deleted attachment's file just sits in the bucket forever.
 */
export async function removeTaskAttachment(attachmentId: string) {
  const [row] = await db
    .select({ taskId: attachments.taskId, projectId: attachments.projectId, storagePath: attachments.storagePath })
    .from(attachments)
    .where(eq(attachments.id, attachmentId));
  await db.delete(attachments).where(eq(attachments.id, attachmentId));
  if (!row) return null;
  if (row.storagePath) await deleteStorageObjects([row.storagePath]);
  if (row.projectId) return row.projectId;
  return row.taskId ? getTaskProjectId(row.taskId) : null;
}

/**
 * Same as removeTaskAttachment, applied to many attachments at once (the
 * Files tab's bulk-select bar). Returns the distinct set of affected
 * project ids so the caller knows which project pages to revalidate.
 */
export async function bulkRemoveAttachments(attachmentIds: string[]): Promise<string[]> {
  if (attachmentIds.length === 0) return [];
  const rows = await db
    .select({ taskId: attachments.taskId, projectId: attachments.projectId, storagePath: attachments.storagePath })
    .from(attachments)
    .where(inArray(attachments.id, attachmentIds));
  await db.delete(attachments).where(inArray(attachments.id, attachmentIds));

  const storagePaths = rows.map((r) => r.storagePath).filter((p): p is string => !!p);
  if (storagePaths.length > 0) await deleteStorageObjects(storagePaths);

  const projectIds = new Set<string>();
  for (const row of rows) {
    if (row.projectId) {
      projectIds.add(row.projectId);
    } else if (row.taskId) {
      const pid = await getTaskProjectId(row.taskId);
      if (pid) projectIds.add(pid);
    }
  }
  return Array.from(projectIds);
}

/**
 * Flat task list across every project, with effective (dependency-aware)
 * status computed per-project and joined project/client/stage context.
 * Backs the cross-project Tasks, Today, and QA views.
 */
export async function listAllTasks() {
  const rows = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      parentTaskId: tasks.parentTaskId,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      isCritical: tasks.isCritical,
      dueDate: tasks.dueDate,
      assignee: tasks.assignee,
      isWaitingOnClient: tasks.isWaitingOnClient,
      waitingOnClientSince: tasks.waitingOnClientSince,
      stageKey: stages.key,
      stageName: stages.name,
      projectName: projects.name,
      projectStatus: projects.status,
      clientName: clients.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .innerJoin(stages, eq(tasks.stageId, stages.id))
    .orderBy(tasks.sortOrder);

  const depRows = await db.select().from(taskDependencies);

  const projectIdByTaskId = new Map(rows.map((r) => [r.id, r.projectId]));
  const tasksByProject = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!tasksByProject.has(r.projectId)) tasksByProject.set(r.projectId, []);
    tasksByProject.get(r.projectId)!.push(r);
  }
  const depsByProject = new Map<string, { taskId: string; dependsOnTaskId: string }[]>();
  for (const d of depRows) {
    const pid = projectIdByTaskId.get(d.taskId);
    if (!pid) continue;
    if (!depsByProject.has(pid)) depsByProject.set(pid, []);
    depsByProject.get(pid)!.push({ taskId: d.taskId, dependsOnTaskId: d.dependsOnTaskId });
  }

  const effectiveByTaskId = new Map<string, string>();
  for (const [pid, projectTasks] of tasksByProject) {
    const effective = computeEffectiveStatuses(
      projectTasks.map((t) => ({ id: t.id, status: t.status })),
      depsByProject.get(pid) ?? []
    );
    for (const [taskId, status] of effective) effectiveByTaskId.set(taskId, status);
  }

  return rows.map((r) => ({ ...r, effectiveStatus: effectiveByTaskId.get(r.id) ?? r.status }));
}

/**
 * Adds a one-off task outside the generated workflow — real projects always
 * have surprises the template can't predict. If the chosen stage isn't
 * already materialized for this project (a stage the generator skipped
 * because it had zero tasks at creation time), it's added to project_stages
 * too, so the new task actually has somewhere to render.
 */
export async function createAdHocTask(input: {
  projectId: string;
  stageKey: string;
  title: string;
  priority: string;
  isCritical: boolean;
}) {
  const [stage] = await db.select().from(stages).where(eq(stages.key, input.stageKey));
  if (!stage) throw new Error(`Unknown stage: ${input.stageKey}`);

  const existingStageLink = await db
    .select({ id: projectStages.id })
    .from(projectStages)
    .where(and(eq(projectStages.projectId, input.projectId), eq(projectStages.stageId, stage.id)));

  if (existingStageLink.length === 0) {
    const [{ maxSort }] = await db
      .select({ maxSort: sql<number>`coalesce(max(${projectStages.sortOrder}), -1)` })
      .from(projectStages)
      .where(eq(projectStages.projectId, input.projectId));
    await db.insert(projectStages).values({
      projectId: input.projectId,
      stageId: stage.id,
      sortOrder: maxSort + 1,
    });
  }

  const [{ maxSort: maxTaskSort }] = await db
    .select({ maxSort: sql<number>`coalesce(max(${tasks.sortOrder}), -1)` })
    .from(tasks)
    .where(and(eq(tasks.projectId, input.projectId), isNull(tasks.parentTaskId)));

  const [task] = await db
    .insert(tasks)
    .values({
      projectId: input.projectId,
      stageId: stage.id,
      title: input.title,
      priority: input.priority as (typeof tasks.$inferInsert)["priority"],
      isCritical: input.isCritical,
      sortOrder: maxTaskSort + 1,
    })
    .returning();

  await db.insert(activityLogs).values({
    projectId: input.projectId,
    taskId: task.id,
    action: "task_added_manually",
    detail: task.title,
    actorName: AGENCY_OWNER_NAME,
  });

  return task;
}

const PRIORITY_WEIGHT: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const ESTIMATE_MINUTES: Record<string, number> = { CRITICAL: 45, HIGH: 30, MEDIUM: 20, LOW: 10 };

type AllTasksRow = Awaited<ReturnType<typeof listAllTasks>>[number];

export type ActionQueueItem = {
  taskId: string;
  title: string;
  projectId: string;
  projectName: string;
  priority: string;
  isCritical: boolean;
  estimateMinutes: number;
  // Which project tab this task actually lives in — QA is a separate tab
  // from the rest of the board, so a QA-stage task must route there.
  tabSlug: "tasks" | "qa";
};

/**
 * Dashboard's My Action Queue — every actionable top-level task across
 * every active project, ranked together (critical first, then priority).
 * Unlike a "pick one per project" approach, a project with several urgent
 * tasks can show up more than once — this is "what should I work on next,
 * period," not a per-project summary. No per-task time tracking exists, so
 * the estimate is a priority-based heuristic, good enough to plan a
 * morning. Takes `allTasks` (from `listAllTasks()`) rather than fetching it
 * itself so the dashboard can derive several widgets from one DB scan.
 */
export function deriveActionQueue(allTasks: AllTasksRow[]): ActionQueueItem[] {
  const actionable = allTasks.filter(
    (t) =>
      !t.parentTaskId &&
      t.projectStatus === "ACTIVE" &&
      t.effectiveStatus !== "DONE" &&
      t.effectiveStatus !== "SKIPPED" &&
      t.effectiveStatus !== "BLOCKED"
  );
  actionable.sort((a, b) => {
    if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
    return (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9);
  });
  return actionable.map((t) => ({
    taskId: t.id,
    title: t.title,
    projectId: t.projectId,
    projectName: t.projectName,
    priority: t.priority,
    isCritical: t.isCritical,
    estimateMinutes: ESTIMATE_MINUTES[t.priority] ?? 20,
    tabSlug: t.stageKey === "qa" ? "qa" : "tasks",
  }));
}

export type WaitingOnClientProjectSummary = {
  projectId: string;
  projectName: string;
  taskTitle: string;
  waitingOnClientSince: Date | string | null;
  // Which project tab this task actually lives in — QA is a separate tab
  // from the rest of the board, so a QA-stage task must route there, not
  // to the (empty, for it) Tasks tab.
  tabSlug: "tasks" | "qa";
};

/** One row per project — the longest-waiting flagged task is shown as the reason, oldest first. */
export function deriveWaitingOnClient(allTasks: AllTasksRow[]): WaitingOnClientProjectSummary[] {
  const flagged = allTasks.filter(
    (t) => t.isWaitingOnClient && t.status !== "DONE" && t.status !== "SKIPPED"
  );
  flagged.sort((a, b) => {
    const aTime = a.waitingOnClientSince ? new Date(a.waitingOnClientSince).getTime() : 0;
    const bTime = b.waitingOnClientSince ? new Date(b.waitingOnClientSince).getTime() : 0;
    return aTime - bTime;
  });
  const byProject = new Map<string, WaitingOnClientProjectSummary>();
  for (const t of flagged) {
    if (byProject.has(t.projectId)) continue;
    byProject.set(t.projectId, {
      projectId: t.projectId,
      projectName: t.projectName,
      taskTitle: t.title,
      waitingOnClientSince: t.waitingOnClientSince,
      tabSlug: t.stageKey === "qa" ? "qa" : "tasks",
    });
  }
  return Array.from(byProject.values());
}

export type BlockedProjectSummary = {
  projectId: string;
  projectName: string;
  taskTitle: string;
  // Which project tab this task actually lives in — QA is a separate tab
  // from the rest of the board, so a QA-stage task must route there.
  tabSlug: "tasks" | "qa";
};

/** One row per active project with at least one dependency-blocked top-level task, showing that task as the reason. */
export function deriveBlockedProjects(allTasks: AllTasksRow[]): BlockedProjectSummary[] {
  const byProject = new Map<string, BlockedProjectSummary>();
  for (const t of allTasks) {
    if (t.parentTaskId || t.projectStatus !== "ACTIVE" || t.effectiveStatus !== "BLOCKED") continue;
    if (byProject.has(t.projectId)) continue;
    byProject.set(t.projectId, {
      projectId: t.projectId,
      projectName: t.projectName,
      taskTitle: t.title,
      tabSlug: t.stageKey === "qa" ? "qa" : "tasks",
    });
  }
  return Array.from(byProject.values());
}

export type ReadyToLaunchSummary = {
  projectId: string;
  projectName: string;
  launchScorePercent: number;
};

/**
 * "Launch readiness" for every active project with at least one critical
 * task — critical-task completion %, sorted highest first. Shared by
 * `deriveReadyToLaunch` (the dashboard's Ready to Launch list, threshold-
 * filtered) and the dashboard's Command Center panel (which auto-features
 * whichever active project ranks #1 here, regardless of threshold).
 */
export function deriveLaunchReadinessRanking(allTasks: AllTasksRow[]): ReadyToLaunchSummary[] {
  const criticalByProject = new Map<string, { done: number; total: number; name: string }>();
  for (const t of allTasks) {
    if (t.parentTaskId || t.projectStatus !== "ACTIVE" || !t.isCritical) continue;
    const entry = criticalByProject.get(t.projectId) ?? { done: 0, total: 0, name: t.projectName };
    entry.total += 1;
    if (t.effectiveStatus === "DONE") entry.done += 1;
    criticalByProject.set(t.projectId, entry);
  }
  const results: ReadyToLaunchSummary[] = [];
  for (const [projectId, { done, total, name }] of criticalByProject) {
    if (total === 0) continue;
    results.push({ projectId, projectName: name, launchScorePercent: Math.round((done / total) * 100) });
  }
  return results.sort((a, b) => b.launchScorePercent - a.launchScorePercent);
}

// Same "On track" threshold the health-score color bands already use
// elsewhere — a project counts as "almost ready" once its critical-task
// completion crosses this, not just once every last one is checked off.
const READY_TO_LAUNCH_THRESHOLD = 85;

/** Active projects whose critical-task completion is at or above the "on track" threshold. */
export function deriveReadyToLaunch(allTasks: AllTasksRow[]): ReadyToLaunchSummary[] {
  return deriveLaunchReadinessRanking(allTasks).filter((r) => r.launchScorePercent >= READY_TO_LAUNCH_THRESHOLD);
}

// ---------------------------------------------------------------------------
// Client-facing handoff page
// ---------------------------------------------------------------------------

/** Sets (or returns the existing) handoff token for a project. */
export async function generateHandoffLink(projectId: string): Promise<string> {
  const [existing] = await db
    .select({ handoffToken: projects.handoffToken })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (existing?.handoffToken) return existing.handoffToken;

  const token = randomBytes(24).toString("hex");
  await db.update(projects).set({ handoffToken: token }).where(eq(projects.id, projectId));
  await db.insert(activityLogs).values({
    projectId,
    action: "handoff_link_generated",
    detail: null,
    actorName: AGENCY_OWNER_NAME,
  });
  return token;
}

export async function revokeHandoffLink(projectId: string): Promise<void> {
  await db.update(projects).set({ handoffToken: null }).where(eq(projects.id, projectId));
  await db.insert(activityLogs).values({
    projectId,
    action: "handoff_link_revoked",
    detail: null,
    actorName: AGENCY_OWNER_NAME,
  });
}

/**
 * The data backing the public /handoff/[token] page. Deliberately narrow —
 * no task notes, no internal assignee/due-date detail, and access items
 * never include passwords. This is a client-presentable summary, not an
 * export of the internal project record.
 */
export async function getProjectByHandoffToken(token: string) {
  const [project] = await db.select().from(projects).where(eq(projects.handoffToken, token));
  if (!project) return null;

  // Every real load of the public page is a genuine client visit — logged
  // so Command Center can show "last viewed" and Paul knows whether the
  // client actually opened the link he sent.
  await db.insert(activityLogs).values({
    projectId: project.id,
    action: "handoff_viewed",
    detail: null,
    actorName: CLIENT_ACTOR_NAME,
  });

  const [client, techRows, taskRows, completedRows, accessRows, clientActionRows] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, project.clientId)).then((r) => r[0]),
    db
      .select({ name: technologies.name })
      .from(projectTechnologies)
      .innerJoin(technologies, eq(projectTechnologies.technologyId, technologies.id))
      .where(eq(projectTechnologies.projectId, project.id)),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        isCritical: tasks.isCritical,
        canonicalKey: tasks.canonicalKey,
      })
      .from(tasks)
      .where(and(eq(tasks.projectId, project.id), eq(tasks.isCritical, true))),
    // Full scope of completed work — not just the critical/launch checklist
    // above — so the client can see everything delivered, not only what was
    // launch-blocking. Top-level tasks only; subtask-level detail is internal.
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        stageName: stages.name,
        stageSortOrder: stages.sortOrder,
      })
      .from(tasks)
      .innerJoin(stages, eq(tasks.stageId, stages.id))
      .where(and(eq(tasks.projectId, project.id), eq(tasks.status, "DONE"), isNull(tasks.parentTaskId)))
      .orderBy(stages.sortOrder, tasks.sortOrder),
    db
      .select({
        id: accessItems.id,
        name: accessItems.name,
        url: accessItems.url,
        username: accessItems.username,
        status: accessItems.status,
      })
      .from(accessItems)
      .where(and(eq(accessItems.projectId, project.id), ne(accessItems.status, "NOT_NEEDED"))),
    db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status })
      .from(tasks)
      .where(
        and(eq(tasks.projectId, project.id), inArray(tasks.canonicalKey, Array.from(CLIENT_ACTION_CANONICAL_KEYS)))
      ),
  ]);

  return {
    project,
    clientName: client?.name ?? "",
    technologies: techRows.map((t) => t.name),
    criticalTasks: taskRows,
    completedTasks: completedRows,
    accessItems: accessRows,
    clientActionTasks: clientActionRows,
  };
}

// ---------------------------------------------------------------------------
// Recent activity
// ---------------------------------------------------------------------------

/** Most recent activity_logs entries for a project, newest first, with the related task's title when there is one. */
export async function listRecentActivity(projectId: string, limit = 8) {
  return db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      detail: activityLogs.detail,
      createdAt: activityLogs.createdAt,
      actorName: activityLogs.actorName,
      taskTitle: tasks.title,
    })
    .from(activityLogs)
    .leftJoin(tasks, eq(activityLogs.taskId, tasks.id))
    .where(eq(activityLogs.projectId, projectId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

/** Same as `listRecentActivity` but across every project — backs the dashboard's Recent Activity feed. */
export async function listRecentActivityAcrossProjects(limit = 10) {
  return db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      detail: activityLogs.detail,
      createdAt: activityLogs.createdAt,
      actorName: activityLogs.actorName,
      taskTitle: tasks.title,
      projectId: activityLogs.projectId,
      projectName: projects.name,
    })
    .from(activityLogs)
    .innerJoin(projects, eq(activityLogs.projectId, projects.id))
    .leftJoin(tasks, eq(activityLogs.taskId, tasks.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

/** Most recent time the client actually opened the public /handoff/[token] page, or null if never. */
export async function getLastHandoffView(projectId: string): Promise<Date | null> {
  const [row] = await db
    .select({ createdAt: activityLogs.createdAt })
    .from(activityLogs)
    .where(and(eq(activityLogs.projectId, projectId), eq(activityLogs.action, "handoff_viewed")))
    .orderBy(desc(activityLogs.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}

// ---------------------------------------------------------------------------
// Waiting on client
// ---------------------------------------------------------------------------

/**
 * Flags/unflags a task as blocked on the client specifically (not a
 * dependency, not Paul's own backlog). Stamps waitingOnClientSince the
 * moment it's flagged and clears it on unflag, so "oldest waiting" reflects
 * exactly how long the client has been the blocker.
 */
export async function setTaskWaitingOnClient(taskId: string, waiting: boolean): Promise<string | null> {
  const [task] = await db
    .update(tasks)
    .set({ isWaitingOnClient: waiting, waitingOnClientSince: waiting ? new Date() : null, updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning({ projectId: tasks.projectId });
  return task?.projectId ?? null;
}

/** Open tasks currently flagged as waiting on the client, oldest first. */
// ---------------------------------------------------------------------------
// Files, Notes (project-level)
// ---------------------------------------------------------------------------

/**
 * Every attachment touching this project — task-scoped proof (joined to the
 * task's title) and general project-level files alike — newest first.
 * Backs the Files tab; doesn't resolve signed URLs itself (callers do that,
 * same pattern as getProjectDetail's task attachments).
 */
export async function listProjectAttachments(projectId: string) {
  return db
    .select({
      id: attachments.id,
      url: attachments.url,
      storagePath: attachments.storagePath,
      label: attachments.label,
      fileSize: attachments.fileSize,
      createdAt: attachments.createdAt,
      taskTitle: tasks.title,
    })
    .from(attachments)
    .leftJoin(tasks, eq(attachments.taskId, tasks.id))
    .where(or(eq(attachments.projectId, projectId), eq(tasks.projectId, projectId)))
    .orderBy(desc(attachments.createdAt));
}

export async function updateProjectNotes(projectId: string, notes: string | null) {
  await db.update(projects).set({ notes, updatedAt: new Date() }).where(eq(projects.id, projectId));
}
