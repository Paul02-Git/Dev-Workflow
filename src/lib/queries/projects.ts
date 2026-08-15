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
} from "@/db/schema";
import { eq, desc, inArray, and } from "drizzle-orm";
import { generateWorkflow } from "@/lib/workflow-engine/generate-workflow";
import { computeEffectiveStatuses } from "@/lib/workflow-engine/blocked-status";
import { computeHealthScore } from "@/lib/health/health-score";
import { checkProject, type TaskLookup } from "@/lib/health/forgotten-task-rules";

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
 * Deletes a project and everything under it. All child tables (tasks,
 * project_stages, project_technologies, access_items, activity_logs, and
 * task_dependencies/tags/attachments transitively via tasks) reference
 * projects.id with ON DELETE CASCADE, so one delete here is sufficient.
 */
export async function deleteProject(id: string) {
  await db.delete(projects).where(eq(projects.id, id));
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
    const subtaskRows = plan.tasks.flatMap((t) =>
      t.subtasks.map((title) => ({
        projectId: project.id,
        stageId: stageIdByKey.get(t.stageKey)!,
        parentTaskId: canonicalKeyToTaskId.get(t.canonicalKey)!,
        title,
        priority: t.priority,
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

  await db.insert(activityLogs).values({
    projectId: project.id,
    action: "project_created",
    detail: `Generated ${plan.tasks.length} tasks across ${plan.stages.length} stages from: ${input.technologyKeys.join(", ")}`,
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

  const tagsByTask = new Map<string, { id: string; name: string }[]>();
  for (const r of tagRows) {
    if (!tagsByTask.has(r.taskId)) tagsByTask.set(r.taskId, []);
    tagsByTask.get(r.taskId)!.push({ id: r.tagId, name: r.tagName });
  }
  const attachmentsByTask = new Map<string, (typeof attachmentRows)[number][]>();
  for (const r of attachmentRows) {
    if (!attachmentsByTask.has(r.taskId)) attachmentsByTask.set(r.taskId, []);
    attachmentsByTask.get(r.taskId)!.push(r);
  }

  return {
    project,
    client,
    stages: projectStageRows,
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

export async function updateTaskStatus(taskId: string, status: string) {
  const completedAt = status === "DONE" ? new Date() : null;
  const [task] = await db
    .update(tasks)
    .set({ status: status as (typeof tasks.$inferInsert)["status"], completedAt, updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();

  if (task) {
    await db.insert(activityLogs).values({
      projectId: task.projectId,
      taskId: task.id,
      action: "task_status_changed",
      detail: status,
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

export async function removeTaskAttachment(attachmentId: string) {
  const [row] = await db
    .select({ taskId: attachments.taskId })
    .from(attachments)
    .where(eq(attachments.id, attachmentId));
  await db.delete(attachments).where(eq(attachments.id, attachmentId));
  return row ? getTaskProjectId(row.taskId) : null;
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
      stageKey: stages.key,
      stageName: stages.name,
      projectName: projects.name,
      projectStatus: projects.status,
      clientName: clients.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .innerJoin(stages, eq(tasks.stageId, stages.id));

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
