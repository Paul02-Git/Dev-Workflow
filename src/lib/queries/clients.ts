import { db } from "@/db/client";
import { clients, projects } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

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
  notes?: string;
}) {
  const [client] = await db.insert(clients).values(input).returning();
  return client;
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
