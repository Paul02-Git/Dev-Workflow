import { randomBytes, randomInt } from "crypto";
import { db } from "@/db/client";
import { clients, projects, tasks } from "@/db/schema";
import { and, desc, eq, gt, ilike, inArray, isNull } from "drizzle-orm";

const MAGIC_LINK_TTL_MS = 20 * 60 * 1000; // 20 minutes

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
 * Mints a fresh magic-link token and a 6-digit code together — always,
 * unlike the old one-time invite link this replaces: a repeat request
 * (client asks for a new link, agency clicks "send login link" again)
 * must invalidate whatever link/code is still sitting in an old email,
 * not return the same one. The code is only ever emailed if the caller
 * separately asks for it (see requestClientMagicCodeAction) — it's minted
 * here regardless so both share one expiry and one invalidation, but the
 * default link email never includes it. Same mechanism for a client's
 * very first login and every one after; there's no separate signup/reset
 * flow anymore.
 */
export async function generateClientMagicLink(clientId: string, organizationId: string): Promise<{ token: string; code: string }> {
  const token = randomBytes(24).toString("hex");
  const code = String(randomInt(1_000_000)).padStart(6, "0");
  await db
    .update(clients)
    .set({ inviteToken: token, inviteCode: code, inviteTokenExpiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS) })
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)));
  return { token, code };
}

/** Just enough to send the magic-link email — the agency-facing "Send login link" button. */
export async function getClientForMagicLinkSend(clientId: string, organizationId: string): Promise<{ name: string; contactEmail: string | null } | null> {
  const [client] = await db
    .select({ name: clients.name, contactEmail: clients.contactEmail })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)));
  return client ?? null;
}

export async function revokeClientInviteLink(clientId: string, organizationId: string): Promise<void> {
  await db
    .update(clients)
    .set({ inviteToken: null, inviteCode: null, inviteTokenExpiresAt: null })
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)));
}

// --- Everything below is reached via the magic-link token/code or the
// client's own session, not an internal organizationId-scoped request.

/**
 * Reusable until it expires, not single-use — a plain read, no
 * consume-and-clear. Single-use was dropped deliberately: email security
 * scanners (Gmail/Google Workspace link scanning, Outlook Safe Links,
 * corporate mail gateways) routinely GET links in an email body before
 * the recipient ever opens it, which silently burned the one-time token
 * before a real click had a chance. Any token/code the same
 * generateClientMagicLink call minted stays valid until
 * inviteTokenExpiresAt regardless of how many times it's used —
 * requesting a *new* link/code (or an explicit revoke) is still what
 * invalidates the old one, exactly as before. Returns null for an
 * unknown or expired token — the caller doesn't need to (and shouldn't)
 * distinguish which.
 */
export async function verifyClientMagicLink(token: string): Promise<{ id: string; name: string } | null> {
  const [client] = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(eq(clients.inviteToken, token), gt(clients.inviteTokenExpiresAt, new Date())));
  return client ?? null;
}

/**
 * Alternative to clicking the emailed link — matched by contactEmail (same
 * single-match-only rule as getClientByContactEmail, for the same
 * no-probing reason) plus the 6-digit code. Reusable until expiry, same
 * as verifyClientMagicLink above and for the same reason — this is a
 * plain read, not a consume-and-clear. Wrong/expired code, ambiguous
 * email, or no email on file all return null without distinguishing why.
 */
export async function verifyClientMagicCode(email: string, code: string): Promise<{ id: string; name: string } | null> {
  const matches = await db
    .select({ id: clients.id, name: clients.name, inviteCode: clients.inviteCode, inviteTokenExpiresAt: clients.inviteTokenExpiresAt })
    .from(clients)
    .where(ilike(clients.contactEmail, email));
  if (matches.length !== 1) return null;

  const client = matches[0];
  if (!client.inviteCode || client.inviteCode !== code) return null;
  if (!client.inviteTokenExpiresAt || client.inviteTokenExpiresAt.getTime() < Date.now()) return null;

  return { id: client.id, name: client.name };
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

/**
 * Powers the magic-link request flow (src/lib/actions.ts's
 * requestClientMagicLinkAction) — looks up a client by contactEmail
 * (case-insensitive; there's no uniqueness constraint on this column,
 * and the same real person could plausibly be a client of two different
 * agencies using this app). Returns null on zero matches *or more than
 * one* — never guesses among ambiguous matches; the caller shows the
 * same generic "check your email" outcome either way, so this never
 * leaks which emails are on file.
 */
export async function getClientByContactEmail(email: string): Promise<{ id: string; name: string; organizationId: string | null } | null> {
  const matches = await db
    .select({ id: clients.id, name: clients.name, organizationId: clients.organizationId })
    .from(clients)
    .where(ilike(clients.contactEmail, email));
  return matches.length === 1 ? matches[0] : null;
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

/** Creates a client from the public intake form (organizationId resolved from the intake token itself, not a session) and immediately mints a magic link so the caller can email them straight into their workspace. */
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
  const { token: magicLinkToken, code: magicLinkCode } = await generateClientMagicLink(client.id, organizationId);
  return { client, magicLinkToken, magicLinkCode };
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
