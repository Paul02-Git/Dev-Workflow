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
import { eq, and, sql } from "drizzle-orm";
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

export async function listMaintenancePlans() {
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
      projectName: projects.name,
      clientName: clients.name,
    })
    .from(maintenancePlans)
    .innerJoin(projects, eq(maintenancePlans.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .orderBy(maintenancePlans.nextDueAt);
}

/** Active plans whose next cycle is due today or earlier — the dashboard's "Maintenance due" list. */
export async function listDueMaintenancePlans() {
  const all = await listMaintenancePlans();
  const now = new Date();
  return all.filter((p) => p.isActive && new Date(p.nextDueAt) <= now);
}

/** This project's maintenance plans only — backs the per-project Settings tab. */
export async function listMaintenancePlansForProject(projectId: string) {
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
      projectName: projects.name,
      clientName: clients.name,
    })
    .from(maintenancePlans)
    .innerJoin(projects, eq(maintenancePlans.projectId, projects.id))
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(eq(maintenancePlans.projectId, projectId))
    .orderBy(maintenancePlans.nextDueAt);
}

export async function createMaintenancePlan(input: {
  projectId: string;
  name: string;
  cadenceDays: number;
  checklistTemplate: string;
}) {
  const [plan] = await db
    .insert(maintenancePlans)
    .values({
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
  input: { isActive?: boolean; cadenceDays?: number; checklistTemplate?: string; name?: string }
) {
  await db
    .update(maintenancePlans)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(maintenancePlans.id, planId));
}

export async function deleteMaintenancePlan(planId: string) {
  await db.delete(maintenancePlans).where(eq(maintenancePlans.id, planId));
}

/**
 * Materializes this cycle's checklist as real tasks on the project, tagged
 * with a dated tag so past cycles stay distinguishable in the task list.
 * nextDueAt is anchored to "now" (not the previous due date) so a plan that
 * sat overdue for a while doesn't come back due again immediately.
 */
export async function generateMaintenanceRun(planId: string): Promise<string | null> {
  const [plan] = await db.select().from(maintenancePlans).where(eq(maintenancePlans.id, planId));
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
      projectId: plan.projectId,
      stageId: stage.id,
      sortOrder: maxSort + 1,
    });
  }

  const now = new Date();
  const cycleTagName = `maintenance:${now.toISOString().slice(0, 7)}`; // e.g. maintenance:2026-08
  const [cycleTag] = await db
    .insert(tags)
    .values({ name: cycleTagName })
    .onConflictDoUpdate({ target: tags.name, set: { name: cycleTagName } })
    .returning();

  const items = plan.checklistTemplate
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (items.length === 0) return plan.projectId;

  const [{ maxSort: maxTaskSort }] = await db
    .select({ maxSort: sql<number>`coalesce(max(${tasks.sortOrder}), -1)` })
    .from(tasks)
    .where(eq(tasks.projectId, plan.projectId));

  const insertedTasks = await db
    .insert(tasks)
    .values(
      items.map((title, i) => ({
        projectId: plan.projectId,
        stageId: stage.id,
        title,
        priority: "MEDIUM" as const,
        sortOrder: maxTaskSort + 1 + i,
      }))
    )
    .returning({ id: tasks.id });

  await db.insert(taskTags).values(insertedTasks.map((t) => ({ taskId: t.id, tagId: cycleTag.id })));

  await db.insert(activityLogs).values({
    projectId: plan.projectId,
    action: "maintenance_run_generated",
    detail: `${plan.name}: ${items.length} task(s) — ${cycleTagName}`,
    actorName: AGENCY_OWNER_NAME,
  });

  await db
    .update(maintenancePlans)
    .set({
      lastGeneratedAt: now,
      nextDueAt: new Date(now.getTime() + plan.cadenceDays * 24 * 60 * 60 * 1000),
      updatedAt: now,
    })
    .where(eq(maintenancePlans.id, planId));

  return plan.projectId;
}
