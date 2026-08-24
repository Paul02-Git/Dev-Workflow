import { randomBytes } from "crypto";
import { db } from "@/db/client";
import { clients, projects, tasks } from "@/db/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import { normalizeSlug } from "@/lib/queries/organizations";

export async function listClients(organizationId: string) {
  return db.select().from(clients).where(eq(clients.organizationId, organizationId)).orderBy(desc(clients.createdAt));
}

export async function getClient(id: string, organizationId: string) {
  const [client] = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.organizationId, organizationId)));
  if (!client) return null;
  const clientProjects = await db.select().from(projects).where(eq(projects.clientId, id));
  return { ...client, projects: clientProjects };
}

export async function createClient(input: {
  organizationId: string;
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
  organizationId: string,
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
    .where(and(eq(clients.id, id), eq(clients.organizationId, organizationId)))
    .returning();
  return client;
}

/**
 * Mints (or returns the existing) one-time invite/reset token — visiting
 * /client-invite/[token] lets the client set loginSlug+password via
 * setClientPassword() below. Idempotent while pending (repeat clicks of
 * "Send invite" return the same link rather than invalidating an
 * already-sent one) but works just as well as a "resend"/"reset password"
 * mechanism even after the client has already set a password — there's no
 * separate forgot-password flow; generating a fresh invite and setting a
 * new password through it *is* the reset flow.
 */
export async function generateClientInviteLink(clientId: string, organizationId: string): Promise<string> {
  const [existing] = await db
    .select({ inviteToken: clients.inviteToken })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)));
  if (existing?.inviteToken) return existing.inviteToken;
  const token = randomBytes(24).toString("hex");
  await db.update(clients).set({ inviteToken: token }).where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)));
  return token;
}

export async function revokeClientInviteLink(clientId: string, organizationId: string): Promise<void> {
  await db.update(clients).set({ inviteToken: null }).where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)));
}

// --- Everything below is reached via the invite token or the client's own
// session, not an internal organizationId-scoped request.

export async function getClientByInviteToken(token: string) {
  const [client] = await db.select().from(clients).where(eq(clients.inviteToken, token));
  return client ?? null;
}

/**
 * Completes the invite flow: picks a globally-unique loginSlug from the
 * client's name (falling back to a random suffix on collision, same
 * pattern organizations.createOrganization uses for its own slug), hashes
 * the password, and clears inviteToken so it can't be reused — a fresh
 * invite must be generated for a subsequent reset. Returns the final slug
 * so the caller can show/log the client in immediately.
 */
export async function setClientPassword(inviteToken: string, password: string): Promise<{ id: string; loginSlug: string } | null> {
  const client = await getClientByInviteToken(inviteToken);
  if (!client) return null;

  let loginSlug = normalizeSlug(client.name) || "client";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? loginSlug : `${loginSlug}-${randomBytes(2).toString("hex")}`;
    const [existing] = await db.select({ id: clients.id }).from(clients).where(eq(clients.loginSlug, candidate));
    if (!existing || existing.id === client.id) {
      loginSlug = candidate;
      break;
    }
  }

  await db
    .update(clients)
    .set({ loginSlug, passwordHash: hashPassword(password), inviteToken: null, updatedAt: new Date() })
    .where(eq(clients.id, client.id));

  return { id: client.id, loginSlug };
}

/**
 * Ownership check (client + project id only, no joins into task/stage
 * data) for actions that just need to confirm "does this logged-in client
 * actually own this project" before writing — comments and uploads don't
 * need the full getClientProjectPortalDetail() payload to do that. Returns
 * the project's organizationId on success (also needed by these callers to
 * scope the actual write), or null if this client doesn't own that
 * project. clientId comes from requireClientAuth()'s signed session, never
 * from request input — never skip that step before calling this.
 */
export async function verifyClientOwnsProjectBySession(clientId: string, projectId: string): Promise<string | null> {
  const [row] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(and(eq(projects.clientId, clientId), eq(projects.id, projectId)));
  return row?.organizationId ?? null;
}

/** A client's own record, for self-service actions (the Settings tab) where clientId comes from their own session rather than an organization-scoped lookup. */
export async function getClientRecordForSelf(clientId: string) {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
  return client ?? null;
}

/** Client Workspace overview — the client's own record plus every project they have, with progress. clientId comes from the client's own session, not a token. */
export async function getClientPortalDashboard(clientId: string) {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
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

/** Creates a client from the public intake form (organizationId resolved from the intake token itself, not a session) and immediately mints their invite link so they can set a password and land in their workspace right away. */
export async function createClientViaIntake(input: {
  organizationId: string;
  name: string;
  company?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}) {
  const { organizationId, ...rest } = input;
  const client = await createClient({ ...rest, organizationId, source: "intake" });
  const inviteToken = await generateClientInviteLink(client.id, organizationId);
  return { client, inviteToken };
}

/**
 * Refuses to delete a client that still has projects — projects.clientId
 * has no cascade, and silently mass-deleting a client's whole project
 * history from one click is exactly the kind of surprise a destructive
 * action shouldn't produce. Delete the projects first.
 */
export async function deleteClient(id: string, organizationId: string) {
  const existingProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.clientId, id));
  if (existingProjects.length > 0) {
    throw new Error(
      `Can't delete this client — it still has ${existingProjects.length} project(s). Delete those first.`
    );
  }
  await db.delete(clients).where(and(eq(clients.id, id), eq(clients.organizationId, organizationId)));
}
