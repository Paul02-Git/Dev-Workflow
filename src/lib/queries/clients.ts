import { randomBytes } from "crypto";
import { db } from "@/db/client";
import { clients, projects, tasks } from "@/db/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";

export async function listClients() {
  return db.select().from(clients).orderBy(desc(clients.createdAt));
}

export async function getClient(id: string) {
  const [client] = await db.select().from(clients).where(eq(clients.id, id));
  if (!client) return null;
  const clientProjects = await db.select().from(projects).where(eq(projects.clientId, id));
  return { ...client, projects: clientProjects };
}

export async function createClient(input: {
  name: string;
  company?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  notes?: string;
  source?: "manual" | "intake";
}) {
  const [client] = await db.insert(clients).values(input).returning();
  return client;
}

export async function updateClient(
  id: string,
  input: { name: string; company?: string; contactEmail?: string; contactPhone?: string; address?: string }
) {
  const [client] = await db
    .update(clients)
    .set({
      name: input.name,
      company: input.company ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      address: input.address ?? null,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, id))
    .returning();
  return client;
}

/**
 * Client Portal — a persistent, unguessable link (same shape as
 * generateHandoffLink/revokeHandoffLink in queries/projects.ts, one level
 * up: client instead of project) giving the client a dashboard of every
 * project they have, no login required.
 */
export async function generateClientPortalLink(clientId: string): Promise<string> {
  const [existing] = await db.select({ portalToken: clients.portalToken }).from(clients).where(eq(clients.id, clientId));
  if (existing?.portalToken) return existing.portalToken;
  const token = randomBytes(24).toString("hex");
  await db.update(clients).set({ portalToken: token }).where(eq(clients.id, clientId));
  return token;
}

export async function revokeClientPortalLink(clientId: string): Promise<void> {
  await db.update(clients).set({ portalToken: null }).where(eq(clients.id, clientId));
}

export async function getClientByPortalToken(token: string) {
  const [client] = await db.select().from(clients).where(eq(clients.portalToken, token));
  return client ?? null;
}

/**
 * Cheap ownership check (client + project id only, no joins into task/stage
 * data) for actions that just need to confirm "does this portal token's
 * client actually own this project" before writing — comments and uploads
 * don't need the full getClientProjectPortalDetail() payload to do that.
 */
export async function verifyClientOwnsProject(portalToken: string, projectId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: projects.id })
    .from(clients)
    .innerJoin(projects, eq(projects.clientId, clients.id))
    .where(and(eq(clients.portalToken, portalToken), eq(projects.id, projectId)));
  return !!row;
}

/** Client Portal dashboard — the client's own record plus every project they have, with progress. */
export async function getClientPortalDashboard(token: string) {
  const client = await getClientByPortalToken(token);
  if (!client) return null;

  const clientProjects = await db.select().from(projects).where(eq(projects.clientId, client.id));
  if (clientProjects.length === 0) return { client, projects: [] };

  const projectIds = clientProjects.map((p) => p.id);
  const topLevelTasks = await db
    .select({ projectId: tasks.projectId, status: tasks.status })
    .from(tasks)
    .where(and(inArray(tasks.projectId, projectIds), isNull(tasks.parentTaskId)));

  const projectsWithProgress = clientProjects.map((p) => {
    const projectTasks = topLevelTasks.filter((t) => t.projectId === p.id);
    return {
      id: p.id,
      name: p.name,
      projectType: p.projectType,
      status: p.status,
      targetLaunchDate: p.targetLaunchDate,
      tasksDone: projectTasks.filter((t) => t.status === "DONE").length,
      tasksTotal: projectTasks.length,
    };
  });

  return { client, projects: projectsWithProgress };
}

/** Creates a client from the public intake form and immediately mints their portal link. */
export async function createClientViaIntake(input: {
  name: string;
  company?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}) {
  const client = await createClient({ ...input, source: "intake" });
  const portalToken = await generateClientPortalLink(client.id);
  return { client, portalToken };
}

/**
 * Refuses to delete a client that still has projects — projects.clientId
 * has no cascade, and silently mass-deleting a client's whole project
 * history from one click is exactly the kind of surprise a destructive
 * action shouldn't produce. Delete the projects first.
 */
export async function deleteClient(id: string) {
  const existingProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.clientId, id));
  if (existingProjects.length > 0) {
    throw new Error(
      `Can't delete this client — it still has ${existingProjects.length} project(s). Delete those first.`
    );
  }
  await db.delete(clients).where(eq(clients.id, id));
}
