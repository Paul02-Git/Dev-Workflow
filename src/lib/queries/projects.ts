import { cache } from "react";
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
  projectMessages,
} from "@/db/schema";
import { eq, desc, inArray, and, or, isNull, isNotNull, sql, ne } from "drizzle-orm";
import { randomBytes } from "crypto";
import { deleteStorageObjects, getSignedAttachmentUrl } from "@/lib/storage";
import { generateWorkflow } from "@/lib/workflow-engine/generate-workflow";
import { computeEffectiveStatuses } from "@/lib/workflow-engine/blocked-status";
import { computeHealthScore } from "@/lib/health/health-score";
import { checkProject, type TaskLookup } from "@/lib/health/forgotten-task-rules";
import { accessItemPresetsForTechnologies } from "@/data/access-item-presets";
import { CLIENT_ACTION_CANONICAL_KEYS } from "@/data/client-action-keys";
import { AGENCY_OWNER_NAME, CLIENT_ACTOR_NAME } from "@/data/agency-info";
import { CLIENT_PORTAL_PHASES } from "@/data/client-portal-phases";
import { withTimeout } from "@/lib/with-timeout";

export async function listProjects() {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      projectType: projects.projectType,
      status: projects.status,
      healthScore: projects.healthScore,
      launchReady: projects.launchReady,
      domain: projects.domain,
      targetLaunchDate: projects.targetLaunchDate,
      launchedAt: projects.launchedAt,
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
// Wrapped in React's cache() — this fires from both the layout (every
// page) and the dashboard page itself in the same request, and the two
// calls were previously each doing their own round-trip. cache() only
// dedupes calls within a single request's render, never persists across
// requests, so it can never serve stale data — a fresh request always
// runs the real query at least once.
export const listProjectsForSwitcher = cache(async () => {
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
});

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
  // Two parallel "waves" instead of ~7 queries run one at a time — every
  // query here that only needs projectId (not something from an earlier
  // query's result) fires together. This used to be fully sequential,
  // which was fine on the old session pooler but got materially slower
  // once the DB moved to the transaction pooler (real, measured: ~2s for
  // this function alone on a mid-size project, dominated by round-trip
  // count, not query cost).
  // TEMPORARY diagnostic instrumentation (2026-08-23) — tracking down a
  // production-only "wave 1 timed out after 8000ms" that survived both a
  // duplicate-polling fix and a Vercel function region change (iad1 ->
  // hnd1), and never reproduces against the same DB from outside Vercel.
  // Logs per-query elapsed time (fired via .then, independent of the
  // withTimeout race) so a real failure tells us WHICH piece is slow
  // instead of just "something was". Remove once the cause is found.
  const wave1Start = performance.now();
  const timed = <T,>(label: string, p: Promise<T>): Promise<T> =>
    p.then(
      (r) => {
        console.log(`[wave1 diag] ${label} resolved at ${(performance.now() - wave1Start).toFixed(0)}ms`);
        return r;
      },
      (e) => {
        console.log(`[wave1 diag] ${label} REJECTED at ${(performance.now() - wave1Start).toFixed(0)}ms: ${e}`);
        throw e;
      }
    );
  const [projectRows, projectStageRows, taskRows, techRows] = await withTimeout(
    Promise.all([
      timed("project", db.select().from(projects).where(eq(projects.id, projectId))),
      timed(
        "stages",
        db
          .select({ id: stages.id, key: stages.key, name: stages.name, sortOrder: projectStages.sortOrder })
          .from(projectStages)
          .innerJoin(stages, eq(projectStages.stageId, stages.id))
          .where(eq(projectStages.projectId, projectId))
          .orderBy(projectStages.sortOrder)
      ),
      timed("tasks", db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(tasks.sortOrder)),
      timed(
        "technologies",
        db
          .select({ name: technologies.name })
          .from(projectTechnologies)
          .innerJoin(technologies, eq(projectTechnologies.technologyId, technologies.id))
          .where(eq(projectTechnologies.projectId, projectId))
      ),
    ]),
    8000,
    "getProjectDetail wave 1"
  );
  const [project] = projectRows;
  if (!project) return null;

  const taskIds = taskRows.map((t) => t.id);

  const [client, depRows, tagRows, attachmentRows] = await withTimeout(
    Promise.all([
    db
      .select()
      .from(clients)
      .where(eq(clients.id, project.clientId))
      .then((r) => r[0]),
    taskIds.length > 0
      ? db.select().from(taskDependencies).where(inArray(taskDependencies.taskId, taskIds))
      : Promise.resolve([]),
    taskIds.length > 0
      ? db
          .select({ taskId: taskTags.taskId, tagId: tags.id, tagName: tags.name })
          .from(taskTags)
          .innerJoin(tags, eq(taskTags.tagId, tags.id))
          .where(inArray(taskTags.taskId, taskIds))
      : Promise.resolve([]),
    taskIds.length > 0
      ? db.select().from(attachments).where(inArray(attachments.taskId, taskIds))
      : Promise.resolve([]),
    ]),
    8000,
    "getProjectDetail wave 2"
  );

  const effective = computeEffectiveStatuses(
    taskRows.map((t) => ({ id: t.id, status: t.status })),
    depRows.map((d) => ({ taskId: d.taskId, dependsOnTaskId: d.dependsOnTaskId }))
  );

  const healthScore = computeHealthScore(
    taskRows.map((t) => ({ status: t.status, isCritical: t.isCritical, dueDate: t.dueDate })),
    taskRows.map((t) => effective.get(t.id) ?? t.status)
  );

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
 * deleted attachment's file just sits in the bucket forever. A real,
 * immediate delete regardless of who triggers it (Paul internally, or a
 * client via deleteClientFileAction) — removes it for both sides.
 */
export async function removeTaskAttachment(attachmentId: string) {
  const [row] = await db
    .select({ taskId: attachments.taskId, projectId: attachments.projectId, storagePath: attachments.storagePath })
    .from(attachments)
    .where(eq(attachments.id, attachmentId));
  if (!row) return null;
  await db.delete(attachments).where(eq(attachments.id, attachmentId));
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

/** Looks up which project an attachment belongs to — used to authorize a client's delete request before touching anything. */
export async function getAttachmentProjectId(attachmentId: string): Promise<string | null> {
  const [row] = await db.select({ projectId: attachments.projectId }).from(attachments).where(eq(attachments.id, attachmentId));
  return row?.projectId ?? null;
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
      canonicalKey: tasks.canonicalKey,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      isCritical: tasks.isCritical,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
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

// Which project-page tab a task's stage actually renders under — QA and
// Launch/Handoff/Post-Launch are both separate tabs from the rest of the
// board (see the project page's own buildStages/qaStages/launchStages),
// so a task in either group must route there, not to the Tasks tab.
const LAUNCH_GROUP_STAGE_KEYS = new Set(["launch", "handoff", "post_launch"]);
function tabSlugForStageKey(stageKey: string): "tasks" | "qa" | "launch" {
  if (stageKey === "qa") return "qa";
  if (LAUNCH_GROUP_STAGE_KEYS.has(stageKey)) return "launch";
  return "tasks";
}

export type ActionQueueItem = {
  taskId: string;
  title: string;
  projectId: string;
  projectName: string;
  priority: string;
  isCritical: boolean;
  estimateMinutes: number;
  // Which project tab this task actually lives in — QA and Launch/Handoff/
  // Post-Launch are each their own tab, separate from the rest of the board.
  tabSlug: "tasks" | "qa" | "launch";
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
    tabSlug: tabSlugForStageKey(t.stageKey),
  }));
}

export type WaitingOnClientProjectSummary = {
  projectId: string;
  projectName: string;
  taskTitle: string;
  waitingOnClientSince: Date | string | null;
  // Which project tab this task actually lives in — QA and Launch/Handoff/
  // Post-Launch are each their own tab, not the (empty, for them) Tasks tab.
  tabSlug: "tasks" | "qa" | "launch";
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
      tabSlug: tabSlugForStageKey(t.stageKey),
    });
  }
  return Array.from(byProject.values());
}

export type BlockedProjectSummary = {
  projectId: string;
  projectName: string;
  taskTitle: string;
  // Which project tab this task actually lives in — QA and Launch/Handoff/
  // Post-Launch are each their own tab, separate from the rest of the board.
  tabSlug: "tasks" | "qa" | "launch";
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
      tabSlug: tabSlugForStageKey(t.stageKey),
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

export type OverdueLaunchSummary = {
  projectId: string;
  projectName: string;
  clientName: string;
  targetLaunchDate: Date | string;
  daysOverdue: number;
  criticalDone: number;
  criticalTotal: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Active projects whose target launch date has already passed while the
 * critical (launch-checklist) tasks still aren't all done — the dashboard's
 * "Launch overdue" banner. A project with zero critical tasks is trivially
 * "complete" (nothing to check off) and isn't flagged, same as a project
 * with no `targetLaunchDate` set at all.
 */
export function deriveOverdueLaunches(
  allTasks: AllTasksRow[],
  projects: { id: string; name: string; clientName: string; status: string; targetLaunchDate: Date | string | null }[]
): OverdueLaunchSummary[] {
  const criticalByProject = new Map<string, { done: number; total: number }>();
  for (const t of allTasks) {
    if (t.parentTaskId || !t.isCritical) continue;
    const entry = criticalByProject.get(t.projectId) ?? { done: 0, total: 0 };
    entry.total += 1;
    if (t.effectiveStatus === "DONE") entry.done += 1;
    criticalByProject.set(t.projectId, entry);
  }

  const now = Date.now();
  const results: OverdueLaunchSummary[] = [];
  for (const p of projects) {
    if (p.status !== "ACTIVE" || !p.targetLaunchDate) continue;
    const targetTime = new Date(p.targetLaunchDate).getTime();
    if (targetTime > now) continue;
    const critical = criticalByProject.get(p.id);
    if (!critical || critical.total === 0 || critical.done >= critical.total) continue;
    results.push({
      projectId: p.id,
      projectName: p.name,
      clientName: p.clientName,
      targetLaunchDate: p.targetLaunchDate,
      daysOverdue: Math.floor((now - targetTime) / DAY_MS),
      criticalDone: critical.done,
      criticalTotal: critical.total,
    });
  }
  return results.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export type ProjectCardSummary = {
  tasksDone: number;
  tasksTotal: number;
  criticalDone: number;
  criticalTotal: number;
  blockedTaskTitle: string | null;
  waitingTaskTitle: string | null;
  nextAction: { title: string; priority: string; isCritical: boolean } | null;
  issues: { id: string; message: string }[];
};

/**
 * One summary per project for the `/projects` grid — reuses the same
 * single cross-project `listAllTasks()` scan every other cross-project view
 * already does (Tasks/Today/QA/dashboard), rather than calling
 * `getProjectDetail()` once per project (an N+1 pattern that's expensive
 * enough on its own, and directly the kind of concurrent-query burst that
 * exhausted the DB connection pool before — see with-timeout.ts). Every
 * status here (not just ACTIVE) gets a summary, unlike the dashboard's
 * derive* helpers which only look at active projects.
 */
export function deriveProjectCardSummaries(
  allTasks: AllTasksRow[],
  projectCreatedAtById: Map<string, Date | string>
): Map<string, ProjectCardSummary> {
  const byProject = new Map<string, AllTasksRow[]>();
  for (const t of allTasks) {
    if (!byProject.has(t.projectId)) byProject.set(t.projectId, []);
    byProject.get(t.projectId)!.push(t);
  }

  const result = new Map<string, ProjectCardSummary>();
  for (const [projectId, projectTasks] of byProject) {
    const topLevel = projectTasks.filter((t) => !t.parentTaskId);
    const tasksDone = topLevel.filter((t) => t.effectiveStatus === "DONE").length;
    const critical = topLevel.filter((t) => t.isCritical);
    const criticalDone = critical.filter((t) => t.effectiveStatus === "DONE").length;

    const blocked = topLevel.find((t) => t.effectiveStatus === "BLOCKED");

    const waiting = projectTasks
      .filter((t) => t.isWaitingOnClient && t.status !== "DONE" && t.status !== "SKIPPED")
      .sort((a, b) => {
        const aTime = a.waitingOnClientSince ? new Date(a.waitingOnClientSince).getTime() : 0;
        const bTime = b.waitingOnClientSince ? new Date(b.waitingOnClientSince).getTime() : 0;
        return aTime - bTime;
      })[0];

    const actionable = topLevel
      .filter((t) => t.effectiveStatus !== "DONE" && t.effectiveStatus !== "SKIPPED" && t.effectiveStatus !== "BLOCKED")
      .sort((a, b) => {
        if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
        return (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9);
      });
    const next = actionable[0];

    const byCanonicalKey = new Map(projectTasks.filter((t) => t.canonicalKey).map((t) => [t.canonicalKey!, t]));
    const createdAt = projectCreatedAtById.get(projectId);
    const now = Date.now();
    const lookup: TaskLookup = {
      status: (key) => byCanonicalKey.get(key)?.status,
      daysSince: (key) => {
        const task = byCanonicalKey.get(key);
        const anchor = task?.completedAt ?? createdAt;
        if (!task || !anchor) return null;
        return Math.floor((now - new Date(anchor).getTime()) / (1000 * 60 * 60 * 24));
      },
    };

    result.set(projectId, {
      tasksDone,
      tasksTotal: topLevel.length,
      criticalDone,
      criticalTotal: critical.length,
      blockedTaskTitle: blocked?.title ?? null,
      waitingTaskTitle: waiting?.title ?? null,
      nextAction: next ? { title: next.title, priority: next.priority, isCritical: next.isCritical } : null,
      issues: checkProject(lookup),
    });
  }
  return result;
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
/**
 * The client-safe slice of a project's data — technologies, launch
 * checklist, completed work, access items — shared by both the read-only
 * `/handoff/[token]` page and the interactive `/portal` drill-down, which
 * resolve *which* project this is via two different token schemes but need
 * the exact same underlying content.
 */
async function getProjectClientSafeDetail(projectId: string) {
  const [techRows, criticalAndClientActionRows, completedRows, accessRows] = await Promise.all([
    db
      .select({ name: technologies.name })
      .from(projectTechnologies)
      .innerJoin(technologies, eq(projectTechnologies.technologyId, technologies.id))
      .where(eq(projectTechnologies.projectId, projectId)),
    // Critical tasks (the dev/launch checklist) and client-action tasks
    // (the "what we need from you" callout) both come from the same
    // `tasks` table — one query covering both sets, split apart below,
    // instead of two separate queries that only differ by which filter
    // they apply.
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        isCritical: tasks.isCritical,
        canonicalKey: tasks.canonicalKey,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, projectId),
          or(eq(tasks.isCritical, true), inArray(tasks.canonicalKey, Array.from(CLIENT_ACTION_CANONICAL_KEYS)))
        )
      ),
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
      .where(and(eq(tasks.projectId, projectId), eq(tasks.status, "DONE"), isNull(tasks.parentTaskId)))
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
      .where(and(eq(accessItems.projectId, projectId), ne(accessItems.status, "NOT_NEEDED"))),
  ]);

  const criticalTasks = criticalAndClientActionRows.filter((t) => t.isCritical);
  const clientActionTasks = criticalAndClientActionRows
    .filter((t) => CLIENT_ACTION_CANONICAL_KEYS.has(t.canonicalKey ?? ""))
    .map(({ id, title, status }) => ({ id, title, status }));

  return {
    technologies: techRows.map((t) => t.name),
    criticalTasks,
    completedTasks: completedRows,
    accessItems: accessRows,
    clientActionTasks,
  };
}

export async function listProjectMessages(projectId: string) {
  const rows = await db
    .select({
      id: projectMessages.id,
      authorName: projectMessages.authorName,
      body: projectMessages.body,
      createdAt: projectMessages.createdAt,
      attachmentId: attachments.id,
      attachmentLabel: attachments.label,
      attachmentFileSize: attachments.fileSize,
      attachmentStoragePath: attachments.storagePath,
      attachmentUrl: attachments.url,
    })
    .from(projectMessages)
    .leftJoin(attachments, eq(attachments.messageId, projectMessages.id))
    .where(eq(projectMessages.projectId, projectId))
    .orderBy(projectMessages.createdAt);

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      authorName: r.authorName,
      body: r.body,
      createdAt: r.createdAt,
      attachment: r.attachmentId
        ? {
            id: r.attachmentId,
            label: r.attachmentLabel,
            fileSize: r.attachmentFileSize,
            url: r.attachmentStoragePath ? await getSignedAttachmentUrl(r.attachmentStoragePath) : r.attachmentUrl,
          }
        : null,
    }))
  );
}

/** Posts to a project's Comments thread and logs it to Recent Activity — shared by the internal Messages tab (authorName: "Paul") and the public Client Portal (authorName: "Client"). Returns the inserted row so a caller attaching a file can link it to this message's id. */
export async function postProjectMessage(projectId: string, authorName: string, body: string) {
  const [message] = await db.insert(projectMessages).values({ projectId, authorName, body }).returning();
  await db.insert(activityLogs).values({
    projectId,
    action: authorName === CLIENT_ACTOR_NAME ? "client_message_posted" : "message_posted",
    detail: body,
    actorName: authorName,
  });
  return message;
}

/** Which project a message belongs to and who wrote it — used to authorize deletion (a client may only delete their own messages). */
export async function getMessageOwnership(messageId: string) {
  const [row] = await db
    .select({ projectId: projectMessages.projectId, authorName: projectMessages.authorName })
    .from(projectMessages)
    .where(eq(projectMessages.id, messageId));
  return row ?? null;
}

/** Deletes one message. Looks up its attachment's storage path first — deleting the message cascades the attachment's DB row automatically, but the actual Supabase Storage object needs an explicit delete before that row is gone. */
export async function deleteProjectMessage(messageId: string) {
  const [attachment] = await db.select({ storagePath: attachments.storagePath }).from(attachments).where(eq(attachments.messageId, messageId));
  await db.delete(projectMessages).where(eq(projectMessages.id, messageId));
  if (attachment?.storagePath) await deleteStorageObjects([attachment.storagePath]);
}

/** Wipes an entire project's Comments thread, both authors' messages — same storage-cleanup-before-cascade-delete reasoning as deleteProjectMessage. */
export async function deleteAllProjectMessages(projectId: string) {
  const ids = await db.select({ id: projectMessages.id }).from(projectMessages).where(eq(projectMessages.projectId, projectId));
  const messageIds = ids.map((r) => r.id);
  const paths =
    messageIds.length > 0
      ? (await db.select({ storagePath: attachments.storagePath }).from(attachments).where(inArray(attachments.messageId, messageIds)))
          .map((a) => a.storagePath)
          .filter((p): p is string => !!p)
      : [];
  await db.delete(projectMessages).where(eq(projectMessages.projectId, projectId));
  if (paths.length > 0) await deleteStorageObjects(paths);
}

/** Wipes a project's entire activity log — purely a history/audit trail, no cascading cleanup needed (nothing else references activity_logs rows). */
export async function deleteAllProjectActivity(projectId: string) {
  await db.delete(activityLogs).where(eq(activityLogs.projectId, projectId));
}

export async function getProjectByHandoffToken(token: string) {
  // Project + client in one join, instead of two separate round-trips —
  // this page previously fired 8 sequential/parallel queries per load
  // (the one real cause of a hit connection-pool-exhaustion error earlier
  // in this project's history) and is now down to 6.
  const [row] = await db
    .select({ project: projects, clientName: clients.name })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(projects.handoffToken, token));
  if (!row) return null;
  const { project, clientName } = row;

  // Every real load of the public page is a genuine client visit — logged
  // so Command Center can show "last viewed" and Paul knows whether the
  // client actually opened the link he sent.
  await db.insert(activityLogs).values({
    projectId: project.id,
    action: "handoff_viewed",
    detail: null,
    actorName: CLIENT_ACTOR_NAME,
  });

  const detail = await getProjectClientSafeDetail(project.id);
  return { project, clientName: clientName ?? "", ...detail };
}

/**
 * Files a client is allowed to see for a project: what they uploaded
 * themselves, or anything shared via the Comments thread from either side
 * (chat is inherently a shared space — a file Paul sends there should be
 * visible to the client too). Deliberately still excludes Paul's *general*
 * Files-tab uploads outside of chat — that list stays internal-only.
 * Callers are responsible for their own ownership check (this doesn't take
 * a token) — see getClientProjectPortalDetail and the polling route that
 * both call it.
 */
export async function getClientVisibleFiles(projectId: string) {
  const rows = await db
    .select({
      id: attachments.id,
      label: attachments.label,
      fileSize: attachments.fileSize,
      storagePath: attachments.storagePath,
      url: attachments.url,
      createdAt: attachments.createdAt,
    })
    .from(attachments)
    .where(
      and(
        eq(attachments.projectId, projectId),
        or(eq(attachments.uploadedByClient, true), isNotNull(attachments.messageId))
      )
    )
    .orderBy(desc(attachments.createdAt));

  return Promise.all(
    rows.map(async (f) => ({
      ...f,
      url: f.storagePath ? await getSignedAttachmentUrl(f.storagePath) : f.url,
    }))
  );
}

/**
 * Client Portal drill-down — resolves the client from their *client-level*
 * portalToken (not a project-level token), then verifies the requested
 * project actually belongs to that client before returning anything. This
 * ownership check is the one thing standing between a client and being
 * able to view another client's project by guessing a projectId in the
 * URL — never skip it.
 */
export async function getClientProjectPortalDetail(portalToken: string, projectId: string) {
  const [row] = await db
    .select({ project: projects, clientId: clients.id, clientName: clients.name })
    .from(clients)
    .innerJoin(projects, eq(projects.clientId, clients.id))
    .where(and(eq(clients.portalToken, portalToken), eq(projects.id, projectId)));
  if (!row) return null;
  const { project, clientName } = row;

  const [detail, stageRows, clientFiles, messages] = await Promise.all([
    getProjectClientSafeDetail(project.id),
    db
      .select({
        stageKey: stages.key,
        stageSortOrder: stages.sortOrder,
        taskStatus: tasks.status,
      })
      .from(projectStages)
      .innerJoin(stages, eq(projectStages.stageId, stages.id))
      .leftJoin(tasks, and(eq(tasks.stageId, stages.id), eq(tasks.projectId, project.id), isNull(tasks.parentTaskId)))
      .where(eq(projectStages.projectId, project.id)),
    getClientVisibleFiles(project.id),
    listProjectMessages(project.id),
  ]);

  // One row per stage/task combination above — collapse into per-(real)-
  // stage done/total first, then further collapse the up-to-18 internal
  // stages into the 5 client-facing phases from CLIENT_PORTAL_PHASES (the
  // internal app's own granularity — Access & Credentials, Integrations,
  // Security, Handoff, etc. — is more detail than a client needs). A phase
  // only shows if the project actually has at least one task in it.
  const stageMap = new Map<string, { done: number; total: number }>();
  for (const r of stageRows) {
    const entry = stageMap.get(r.stageKey) ?? { done: 0, total: 0 };
    if (r.taskStatus !== null) {
      entry.total += 1;
      if (r.taskStatus === "DONE" || r.taskStatus === "SKIPPED") entry.done += 1;
    }
    stageMap.set(r.stageKey, entry);
  }
  const orderedStages = CLIENT_PORTAL_PHASES.map((phase) => {
    let done = 0;
    let total = 0;
    for (const key of phase.stageKeys) {
      const s = stageMap.get(key);
      if (s) {
        done += s.done;
        total += s.total;
      }
    }
    return { name: phase.name, done, total };
  }).filter((p) => p.total > 0);
  const currentStageIndex = orderedStages.findIndex((s) => s.done < s.total);

  return {
    project,
    clientName: clientName ?? "",
    ...detail,
    stages: orderedStages.map((s, i) => ({
      name: s.name,
      done: s.done,
      total: s.total,
      isCurrent: i === currentStageIndex,
      isDone: currentStageIndex === -1 ? true : i < currentStageIndex,
    })),
    clientFiles,
    messages,
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
  const rows = await db
    .select({
      id: attachments.id,
      url: attachments.url,
      storagePath: attachments.storagePath,
      label: attachments.label,
      fileSize: attachments.fileSize,
      uploadedByClient: attachments.uploadedByClient,
      messageId: attachments.messageId,
      createdAt: attachments.createdAt,
      taskTitle: tasks.title,
    })
    .from(attachments)
    .leftJoin(tasks, eq(attachments.taskId, tasks.id))
    .where(or(eq(attachments.projectId, projectId), eq(tasks.projectId, projectId)))
    .orderBy(desc(attachments.createdAt));
  return rows.map(({ messageId, ...r }) => ({ ...r, viaChat: !!messageId }));
}

/** Same as listProjectAttachments, with signed URLs already resolved for storagePath rows — shared by the Files tab's initial server render and its polling route, so both stay in sync with a single implementation. */
export async function listProjectAttachmentsWithUrls(projectId: string) {
  const files = await listProjectAttachments(projectId);
  return Promise.all(
    files.map(async (f) => ({
      ...f,
      url: f.storagePath ? await getSignedAttachmentUrl(f.storagePath) : f.url,
    }))
  );
}

export async function updateProjectNotes(projectId: string, notes: string | null) {
  await db.update(projects).set({ notes, updatedAt: new Date() }).where(eq(projects.id, projectId));
}
