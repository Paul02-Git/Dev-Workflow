import { db } from "@/db/client";
import {
  maintenancePlans,
  projects,
  clients,
  stages,
  projectStages,
  tasks,
  tags,
  taskTags,
  activityLogs,
} from "@/db/schema";
import { eq, and, sql, inArray, isNull, ne } from "drizzle-orm";
import { AGENCY_OWNER_NAME } from "@/data/agency-info";

// Generated maintenance tasks land in this existing stage (already part of
// STAGES / the workflow templates) rather than a new one — no schema/stage
// changes needed to slot recurring work in alongside the build workflow.
const MAINTENANCE_STAGE_KEY = "post_launch";

export const DEFAULT_MAINTENANCE_CHECKLIST = [
  "Check for WordPress core / plugin / theme updates",
  "Verify latest Cloudways backup exists and is restorable",
  "Check uptime + security scan results",
  "Scan for broken links / 404s",
  "Spot-check page speed (Core Web Vitals)",
  "Send client a short status update",
].join("\n");

export async function listMaintenancePlans(organizationId: string) {
  return db
    .select({
      id: maintenancePlans.id,
      projectId: maintenancePlans.projectId,
      name: maintenancePlans.name,
      cadenceDays: maintenancePlans.cadenceDays,
      checklistTemplate: maintenancePlans.checklistTemplate,
      nextDueAt: maintenancePlans.nextDueAt,
      lastGeneratedAt: maintenancePlans.lastGeneratedAt,
      isActive: maintenancePlans.isActive,
      isPaid: maintenancePlans.isPaid,
      projectName: projects.name,
      clientId: clients.id,
      clientName: clients.name,
    })
    .from(maintenancePlans)
    .innerJoin(projects, eq(maintenancePlans.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(maintenancePlans.organizationId, organizationId))
    .orderBy(maintenancePlans.nextDueAt);
}

/** Active plans whose next cycle is due today or earlier — the dashboard's "Maintenance due" list. */
export async function listDueMaintenancePlans(organizationId: string) {
  const all = await listMaintenancePlans(organizationId);
  const now = new Date();
  return all.filter((p) => p.isActive && new Date(p.nextDueAt) <= now);
}

/** This project's maintenance plans only — backs the per-project Settings tab. */
export async function listMaintenancePlansForProject(projectId: string, organizationId: string) {
  return db
    .select({
      id: maintenancePlans.id,
      projectId: maintenancePlans.projectId,
      name: maintenancePlans.name,
      cadenceDays: maintenancePlans.cadenceDays,
      checklistTemplate: maintenancePlans.checklistTemplate,
      nextDueAt: maintenancePlans.nextDueAt,
      lastGeneratedAt: maintenancePlans.lastGeneratedAt,
      isActive: maintenancePlans.isActive,
      isPaid: maintenancePlans.isPaid,
      projectName: projects.name,
      clientName: clients.name,
    })
    .from(maintenancePlans)
    .innerJoin(projects, eq(maintenancePlans.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(and(eq(maintenancePlans.projectId, projectId), eq(maintenancePlans.organizationId, organizationId)))
    .orderBy(maintenancePlans.nextDueAt);
}

export async function createMaintenancePlan(input: {
  organizationId: string;
  projectId: string;
  name: string;
  cadenceDays: number;
  checklistTemplate: string;
}) {
  const [plan] = await db
    .insert(maintenancePlans)
    .values({
      organizationId: input.organizationId,
      projectId: input.projectId,
      name: input.name,
      cadenceDays: input.cadenceDays,
      checklistTemplate: input.checklistTemplate,
      nextDueAt: new Date(),
    })
    .returning();
  return plan;
}

export async function updateMaintenancePlan(
  planId: string,
  organizationId: string,
  input: { isActive?: boolean; isPaid?: boolean; cadenceDays?: number; checklistTemplate?: string; name?: string }
) {
  await db
    .update(maintenancePlans)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(maintenancePlans.id, planId), eq(maintenancePlans.organizationId, organizationId)));
}

/**
 * Deleting a plan also deletes its not-yet-completed generated tasks —
 * they're just pending checklist items for a plan that no longer exists,
 * not real work. A task already marked DONE or SKIPPED stays (tasks.
 * maintenancePlanId is ON DELETE SET NULL, so it just becomes an
 * unlinked, ordinary task) as a historical record that the work actually
 * happened, rather than being silently erased along with the plan.
 */
export async function deleteMaintenancePlan(planId: string, organizationId: string) {
  await db
    .delete(tasks)
    .where(and(eq(tasks.maintenancePlanId, planId), ne(tasks.status, "DONE"), ne(tasks.status, "SKIPPED")));
  await db.delete(maintenancePlans).where(and(eq(maintenancePlans.id, planId), eq(maintenancePlans.organizationId, organizationId)));
}

/**
 * Advances this plan to its next cycle. Each checklist item is one
 * persistent task (linked via tasks.maintenancePlanId), not a fresh row
 * every time — "Generate" used to insert a brand new duplicate set of
 * tasks on every call, so a project that had been generated a few times
 * ended up with the same checklist repeated over and over in the task
 * list. Now it reconciles against whatever's already linked to this plan:
 * an existing task for a checklist item gets reset to TODO with its due
 * date pushed to the new cycle; only a genuinely new checklist item (one
 * that's never been generated before, e.g. the checklist was edited to add
 * a line) gets a new task row. nextDueAt is anchored to "now" (not the
 * previous due date) so a plan that sat overdue for a while doesn't come
 * back due again immediately.
 */
export async function generateMaintenanceRun(planId: string, organizationId: string): Promise<string | null> {
  const [plan] = await db
    .select()
    .from(maintenancePlans)
    .where(and(eq(maintenancePlans.id, planId), eq(maintenancePlans.organizationId, organizationId)));
  if (!plan) return null;

  const [stage] = await db.select().from(stages).where(eq(stages.key, MAINTENANCE_STAGE_KEY));
  if (!stage) throw new Error(`Missing stage: ${MAINTENANCE_STAGE_KEY}`);

  const existingStageLink = await db
    .select({ id: projectStages.id })
    .from(projectStages)
    .where(and(eq(projectStages.projectId, plan.projectId), eq(projectStages.stageId, stage.id)));

  if (existingStageLink.length === 0) {
    const [{ maxSort }] = await db
      .select({ maxSort: sql<number>`coalesce(max(${projectStages.sortOrder}), -1)` })
      .from(projectStages)
      .where(eq(projectStages.projectId, plan.projectId));
    await db.insert(projectStages).values({
      organizationId,
      projectId: plan.projectId,
      stageId: stage.id,
      sortOrder: maxSort + 1,
    });
  }

  const items = plan.checklistTemplate
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (items.length === 0) return plan.projectId;

  const now = new Date();
  const nextDue = new Date(now.getTime() + plan.cadenceDays * 24 * 60 * 60 * 1000);

  const linkedTasks = await db
    .select({ id: tasks.id, title: tasks.title })
    .from(tasks)
    .where(and(eq(tasks.maintenancePlanId, planId), isNull(tasks.parentTaskId)));
  const linkedByTitle = new Map(linkedTasks.map((t) => [t.title, t.id]));

  const resetIds: string[] = [];
  const newTitles: string[] = [];
  for (const title of items) {
    const existingId = linkedByTitle.get(title);
    if (existingId) resetIds.push(existingId);
    else newTitles.push(title);
  }

  if (resetIds.length > 0) {
    await db
      .update(tasks)
      .set({ status: "TODO", completedAt: null, dueDate: nextDue, updatedAt: now })
      .where(inArray(tasks.id, resetIds));
  }

  if (newTitles.length > 0) {
    const [{ maxSort: maxTaskSort }] = await db
      .select({ maxSort: sql<number>`coalesce(max(${tasks.sortOrder}), -1)` })
      .from(tasks)
      .where(eq(tasks.projectId, plan.projectId));

    const insertedTasks = await db
      .insert(tasks)
      .values(
        newTitles.map((title, i) => ({
          organizationId,
          projectId: plan.projectId,
          stageId: stage.id,
          maintenancePlanId: planId,
          title,
          priority: "MEDIUM" as const,
          dueDate: nextDue,
          sortOrder: maxTaskSort + 1 + i,
        }))
      )
      .returning({ id: tasks.id });

    // A plain "maintenance" tag, not one scoped to this cycle's month —
    // there's only ever one persistent task per checklist item now, so a
    // dated tag would just go stale the moment it rolled into a later cycle.
    const [maintenanceTag] = await db
      .insert(tags)
      .values({ organizationId, name: "maintenance" })
      .onConflictDoUpdate({ target: tags.name, set: { name: "maintenance" } })
      .returning();
    await db.insert(taskTags).values(insertedTasks.map((t) => ({ organizationId, taskId: t.id, tagId: maintenanceTag.id })));
  }

  await db.insert(activityLogs).values({
    organizationId,
    projectId: plan.projectId,
    action: "maintenance_run_generated",
    detail: `${plan.name}: ${resetIds.length} task(s) reset, ${newTitles.length} new — due ${nextDue.toLocaleDateString()}`,
    actorName: AGENCY_OWNER_NAME,
  });

  await db
    .update(maintenancePlans)
    .set({
      lastGeneratedAt: now,
      nextDueAt: nextDue,
      // A new cycle means a new invoice — whatever was paid was for the
      // cycle that just ended, not this one.
      isPaid: false,
      updatedAt: now,
    })
    .where(eq(maintenancePlans.id, planId));

  return plan.projectId;
}
