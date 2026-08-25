"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  createClient,
  updateClient,
  deleteClient,
  createClientViaIntake,
  generateClientMagicLink,
  getClientForMagicLinkSend,
  revokeClientInviteLink,
  verifyClientOwnsProjectBySession,
  getClientByContactEmail,
  verifyClientMagicCode,
  getClientRecordForSelf,
} from "@/lib/queries/clients";
import { cookies } from "next/headers";
import {
  createProjectWithWorkflow,
  updateTaskStatus,
  updateTaskDetails,
  addTaskTag,
  removeTaskTag,
  addTaskAttachment,
  removeTaskAttachment,
  bulkRemoveAttachments,
  deleteProject,
  createAdHocTask,
  updateProjectOverview,
  updateProjectStatus,
  setTaskWaitingOnClient,
  updateProjectNotes,
} from "@/lib/queries/projects";
import {
  createAccessItem,
  updateAccessItem,
  deleteAccessItem,
  setAccessItemCredentials,
  revealAccessItemPassword,
  clearAccessItemCredentials,
} from "@/lib/queries/access-items";
import {
  requireAuth,
  requireClientAuth,
  CLIENT_SESSION_COOKIE_NAME,
  makeClientSessionCookieValue,
  checkClientLoginRateLimit,
  recordClientLoginAttempt,
  getOrganizationActorName,
  getOrganizationContactEmail,
} from "@/lib/auth";
import { sendEmail, renderClientMagicLinkEmail, renderClientMagicCodeEmail } from "@/lib/email";
import { redirect } from "next/navigation";
import { ALL_ACCESS_ITEM_PRESETS, resolvePresetInstructions } from "@/data/access-item-presets";
import { searchAll, type SearchResult } from "@/lib/queries/search";
import { bulkUpdateTaskStatus } from "@/lib/queries/projects";
import {
  createMaintenancePlan,
  updateMaintenancePlan,
  deleteMaintenancePlan,
  generateMaintenanceRun,
} from "@/lib/queries/maintenance";
import {
  generateHandoffLink,
  revokeHandoffLink,
  postProjectMessage,
  getMessageOwnership,
  deleteProjectMessage,
  deleteAllProjectMessages,
  getAttachmentProjectId,
  markClientActionTaskDone,
} from "@/lib/queries/projects";
import {
  uploadTaskAttachment,
  uploadProjectAttachment,
  uploadMessageAttachment,
  replaceAttachment,
  getSignedAttachmentUrl,
} from "@/lib/storage";
import { requirePlatformAdmin, deleteOrganization, restoreOrganization, permanentlyDeleteOrganization } from "@/lib/queries/organizations";
import { resolveIntakeToken, generateIntakeToken, revokeIntakeToken } from "@/lib/queries/agency-settings";
import { CLIENT_ACTOR_NAME } from "@/data/agency-info";
import { PROJECT_TYPES } from "@/data/project-types";
import { headers } from "next/headers";

/** Derives the app's own base URL from the incoming request's Host header — same "trust whatever host actually served the request" approach used for the Google OAuth redirect_uri, avoids needing a separate hardcoded env var for dev vs. prod. */
async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${host}`;
}

/** Shared by every place a client gets logged in from a Server Action (intake auto-login, the code-entry fallback) — the route handler consuming the link itself sets this same cookie independently, since NextResponse's cookie API differs from next/headers' cookies(). */
async function setClientSession(clientId: string): Promise<void> {
  const store = await cookies();
  store.set(CLIENT_SESSION_COOKIE_NAME, makeClientSessionCookieValue(clientId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

// No redirect — this now opens from a modal on the clients list itself
// (see CreateClientForm), so the useful outcome is the dialog closing and
// the new card appearing in the grid you're already looking at, not a
// navigation away from it.
export async function createClientAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Client name is required");

  await createClient({
    organizationId,
    name,
    company: String(formData.get("company") ?? "") || undefined,
    contactEmail: String(formData.get("contactEmail") ?? "") || undefined,
    contactPhone: String(formData.get("contactPhone") ?? "") || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
  });

  revalidatePath("/clients");
}

export async function updateClientAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  const clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!clientId || !name) throw new Error("Client name is required");

  await updateClient(clientId, organizationId, {
    name,
    company: String(formData.get("company") ?? "") || undefined,
    contactEmail: String(formData.get("contactEmail") ?? "") || undefined,
    contactPhone: String(formData.get("contactPhone") ?? "") || undefined,
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}

export async function createProjectAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  let clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const projectType = String(formData.get("projectType") ?? "");
  const technologyKeys = formData.getAll("technologies").map(String);

  if (clientId === "__new__") {
    const newClientName = String(formData.get("newClientName") ?? "").trim();
    if (!newClientName) throw new Error("New client name is required");

    const newClient = await createClient({
      organizationId,
      name: newClientName,
      company: String(formData.get("newClientCompany") ?? "") || undefined,
      contactEmail: String(formData.get("newClientEmail") ?? "") || undefined,
    });
    clientId = newClient.id;
    revalidatePath("/clients");
  }

  if (!clientId || !name || !projectType) {
    throw new Error("Client, name, and project type are required");
  }

  const project = await createProjectWithWorkflow({
    organizationId,
    clientId,
    name,
    projectType,
    technologyKeys,
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateTaskStatusAction(taskId: string, status: string) {
  const { organizationId } = await requireAuth();
  const task = await updateTaskStatus(taskId, organizationId, status);
  if (task) {
    revalidatePath(`/projects/${task.projectId}`);
    revalidatePath("/dashboard");
  }
}

/** "Start Task" on the dashboard's Command Center panel — marks the task in progress and refreshes both pages. */
export async function startDashboardTaskAction(taskId: string) {
  const { organizationId } = await requireAuth();
  const task = await updateTaskStatus(taskId, organizationId, "IN_PROGRESS");
  if (task) {
    revalidatePath("/dashboard");
    revalidatePath(`/projects/${task.projectId}`);
  }
}

export async function updateTaskDetailsAction(
  taskId: string,
  input: { notes?: string | null; dueDate?: string | null; assignee?: string | null }
) {
  const { organizationId } = await requireAuth();
  const task = await updateTaskDetails(taskId, organizationId, {
    notes: input.notes,
    dueDate: input.dueDate ? new Date(input.dueDate) : input.dueDate === "" ? null : undefined,
    assignee: input.assignee,
  });
  if (task) revalidatePath(`/projects/${task.projectId}`);
}

export async function setTaskWaitingOnClientAction(taskId: string, waiting: boolean) {
  const { organizationId } = await requireAuth();
  const projectId = await setTaskWaitingOnClient(taskId, organizationId, waiting);
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/dashboard");
  }
}

export async function addTaskTagAction(taskId: string, tagName: string) {
  const { organizationId } = await requireAuth();
  const projectId = await addTaskTag(taskId, organizationId, tagName);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function removeTaskTagAction(taskId: string, tagId: string) {
  const { organizationId } = await requireAuth();
  const projectId = await removeTaskTag(taskId, organizationId, tagId);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function addTaskAttachmentAction(taskId: string, url: string, label: string) {
  const { organizationId } = await requireAuth();
  const projectId = await addTaskAttachment(taskId, organizationId, { url, label });
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function removeTaskAttachmentAction(attachmentId: string) {
  const { organizationId } = await requireAuth();
  const projectId = await removeTaskAttachment(attachmentId, organizationId);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

/**
 * Resolves signed URLs on demand for a specific set of storage-backed
 * attachments — called only when a task's details modal actually opens,
 * instead of the project page resolving every attachment on every task up
 * front (the real cause of slow/blocked page loads on projects with many
 * attachments — see the comment in projects/[id]/page.tsx).
 */
export async function resolveAttachmentUrlsAction(
  items: { id: string; storagePath: string | null }[]
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};
  await Promise.all(
    items.map(async (item) => {
      if (item.storagePath) results[item.id] = await getSignedAttachmentUrl(item.storagePath);
    })
  );
  return results;
}

export async function bulkRemoveAttachmentsAction(attachmentIds: string[]) {
  const { organizationId } = await requireAuth();
  // No revalidatePath — FilesTab already refetches on its own right after this.
  await bulkRemoveAttachments(attachmentIds, organizationId);
}

export async function replaceAttachmentAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  const attachmentId = String(formData.get("attachmentId") ?? "");
  const file = formData.get("file");
  if (!attachmentId || !(file instanceof File)) {
    throw new Error("Missing attachment or file");
  }
  const projectId = await replaceAttachment(attachmentId, organizationId, file);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectAction(projectId: string) {
  const { organizationId } = await requireAuth();
  await deleteProject(projectId, organizationId);
  revalidatePath("/projects");
  revalidatePath("/clients");
  redirect("/projects");
}

/**
 * Same delete as deleteProjectAction, minus the redirect — for callers
 * already sitting on /projects (the list's row menu, bulk-delete) that
 * don't need to navigate anywhere. deleteProjectAction's redirect() throws
 * a control-flow signal that's only appropriate for a single top-level
 * call from a project's own page; calling it repeatedly in a bulk
 * Promise.all, or from a row that isn't navigating away, would be wrong.
 */
export async function deleteProjectFromListAction(projectId: string) {
  const { organizationId } = await requireAuth();
  await deleteProject(projectId, organizationId);
  revalidatePath("/projects");
  revalidatePath("/clients");
  revalidatePath("/dashboard");
}

export async function deleteClientAction(clientId: string) {
  const { organizationId } = await requireAuth();
  await deleteClient(clientId, organizationId);
  revalidatePath("/clients");
  redirect("/clients");
}

/** Same delete as deleteClientAction, minus the redirect — for a kebab menu on the clients list itself, which is already where deleteClientAction's redirect would send you. */
export async function deleteClientFromListAction(clientId: string) {
  const { organizationId } = await requireAuth();
  await deleteClient(clientId, organizationId);
  revalidatePath("/clients");
}

export async function createTaskAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  const projectId = String(formData.get("projectId") ?? "");
  const stageKey = String(formData.get("stageKey") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const priority = String(formData.get("priority") ?? "MEDIUM");
  const isCritical = formData.get("isCritical") === "on";

  if (!projectId || !stageKey || !title) {
    throw new Error("Stage and title are required");
  }

  await createAdHocTask({ organizationId, projectId, stageKey, title, priority, isCritical });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function updateProjectOverviewAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  const projectId = String(formData.get("projectId") ?? "");
  const domain = String(formData.get("domain") ?? "").trim();
  const targetLaunchDate = String(formData.get("targetLaunchDate") ?? "").trim();

  if (!projectId) throw new Error("Missing project");

  await updateProjectOverview(projectId, organizationId, {
    domain: domain || null,
    targetLaunchDate: targetLaunchDate ? new Date(targetLaunchDate) : null,
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateProjectStatusAction(projectId: string, status: string) {
  const { organizationId } = await requireAuth();
  await updateProjectStatus(projectId, organizationId, status);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function createAccessItemAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!projectId || !name) throw new Error("Name is required");

  await createAccessItem({ organizationId, projectId, name, url, role, instructions, username, password });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

/**
 * The "+ Add platform" quick-add path — one click, no typing. Reuses the
 * exact same preset catalog `createProjectWithWorkflow` seeds new projects
 * from, including the ownership-based initial status (self_created starts
 * already Connected, client_invite starts Not Requested) — adding a
 * platform later this way behaves identically to how it would have looked
 * if the technology had been selected at project creation.
 */
export async function quickAddAccessItemAction(projectId: string, presetName: string) {
  const { organizationId } = await requireAuth();
  const preset = ALL_ACCESS_ITEM_PRESETS.find((p) => p.name === presetName);
  if (!preset) throw new Error("Unknown platform preset");

  const agencyEmail = await getOrganizationContactEmail(organizationId);
  await createAccessItem({
    organizationId,
    projectId,
    name: preset.name,
    role: preset.defaultRole,
    instructions: resolvePresetInstructions(preset.instructions, agencyEmail),
    status: "NOT_REQUESTED",
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function updateAccessItemStatusAction(accessItemId: string, projectId: string, status: string) {
  const { organizationId } = await requireAuth();
  await updateAccessItem(accessItemId, organizationId, { status });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function updateAccessItemDetailsAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  const accessItemId = String(formData.get("accessItemId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();

  if (!accessItemId || !name) throw new Error("Missing access item or name");

  await updateAccessItem(accessItemId, organizationId, { name, url: url || null, role: role || null, instructions: instructions || null });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function clearAccessItemCredentialsAction(accessItemId: string, projectId: string) {
  const { organizationId } = await requireAuth();
  await clearAccessItemCredentials(accessItemId, organizationId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function setAccessItemCredentialsAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  const accessItemId = String(formData.get("accessItemId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!accessItemId) throw new Error("Missing access item");

  await setAccessItemCredentials(accessItemId, organizationId, { username, password: password || undefined });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

/**
 * Every access-item action re-checks the session itself rather than
 * trusting Proxy alone — see requireAuth's comment for why (Next's own
 * guidance on Server Function coverage). This one in particular is the
 * only action that actually returns a plaintext password.
 */
export async function revealAccessItemPasswordAction(accessItemId: string): Promise<string | null> {
  const { organizationId } = await requireAuth();
  return revealAccessItemPassword(accessItemId, organizationId);
}

export async function deleteAccessItemAction(accessItemId: string) {
  const { organizationId } = await requireAuth();
  const projectId = await deleteAccessItem(accessItemId, organizationId);
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/dashboard");
  }
}

export async function searchAction(query: string): Promise<SearchResult[]> {
  return searchAll(query);
}

export async function bulkUpdateTaskStatusAction(taskIds: string[], status: string) {
  const { organizationId } = await requireAuth();
  const projectIds = await bulkUpdateTaskStatus(taskIds, organizationId, status);
  for (const id of projectIds) revalidatePath(`/projects/${id}`);
  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/dashboard");
}

export async function createMaintenancePlanAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const cadenceDays = Number(formData.get("cadenceDays") ?? 30);
  const checklistTemplate = String(formData.get("checklistTemplate") ?? "").trim();

  if (!projectId || !name || !checklistTemplate) {
    throw new Error("Project, name, and checklist are required");
  }

  await createMaintenancePlan({ organizationId, projectId, name, cadenceDays, checklistTemplate });
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
}

export async function updateMaintenancePlanAction(
  planId: string,
  input: { isActive?: boolean; isPaid?: boolean; cadenceDays?: number; checklistTemplate?: string; name?: string }
) {
  const { organizationId } = await requireAuth();
  await updateMaintenancePlan(planId, organizationId, input);
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
}

export async function deleteMaintenancePlanAction(planId: string) {
  const { organizationId } = await requireAuth();
  await deleteMaintenancePlan(planId, organizationId);
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
}

export async function generateMaintenanceRunAction(planId: string) {
  const { organizationId } = await requireAuth();
  const projectId = await generateMaintenanceRun(planId, organizationId);
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function generateHandoffLinkAction(projectId: string) {
  const { organizationId } = await requireAuth();
  const token = await generateHandoffLink(projectId, organizationId);
  revalidatePath(`/projects/${projectId}`);
  return token;
}

export async function revokeHandoffLinkAction(projectId: string) {
  const { organizationId } = await requireAuth();
  await revokeHandoffLink(projectId, organizationId);
  revalidatePath(`/projects/${projectId}`);
}

// ---------------------------------------------------------------------------
// Client Workspace — a real client login (distinct from the per-project
// handoff link above, which stays as a separate, still-useful read-only
// summary link that needs no account at all).
// ---------------------------------------------------------------------------

/** Agency-triggered "Send login link" — mints a fresh magic link and emails it immediately. Returns the token too so the panel can offer a "copy link" fallback for the same link, in case Paul would rather send it through his own channel. */
export async function sendClientMagicLinkAction(clientId: string): Promise<string> {
  const { organizationId } = await requireAuth();
  const client = await getClientForMagicLinkSend(clientId, organizationId);
  if (!client) throw new Error("Client not found");

  const { token } = await generateClientMagicLink(clientId, organizationId);
  if (client.contactEmail) {
    const baseUrl = await getBaseUrl();
    const url = `${baseUrl}/api/client-magic/${token}`;
    const { subject, html } = renderClientMagicLinkEmail({ clientName: client.name, url, isWelcome: false });
    await sendEmail({ to: client.contactEmail, subject, html });
  }
  revalidatePath(`/clients/${clientId}`);
  return token;
}

export async function revokeClientInviteLinkAction(clientId: string) {
  const { organizationId } = await requireAuth();
  await revokeClientInviteLink(clientId, organizationId);
  revalidatePath(`/clients/${clientId}`);
}

// One reusable link per organization — not per-client — that creates a new
// client from whoever fills it out.
export async function generateIntakeLinkAction() {
  const { organizationId } = await requireAuth();
  return generateIntakeToken(organizationId);
}

export async function revokeIntakeLinkAction() {
  const { organizationId } = await requireAuth();
  await revokeIntakeToken(organizationId);
  revalidatePath("/clients");
}

/**
 * Public — no requireAuth(), gated purely by the per-organization intake
 * token (same trust model as every handoff/portal token in this app:
 * unguessable, not a password) — resolveIntakeToken() also tells us WHICH
 * organization this submission belongs to, since intake links are no
 * longer agency-wide-singular now that multiple organizations exist.
 * Always creates a new client; if a project type was selected, also
 * generates a real project via the same createProjectWithWorkflow() the
 * internal /projects/new wizard uses — the workflow engine doesn't know or
 * care whether the caller was Paul or a client filling out intake.
 */
export async function submitIntakeAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const resolved = await resolveIntakeToken(token);
  if (!resolved) throw new Error("This intake link is no longer valid.");
  const { organizationId } = resolved;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  if (!contactEmail) throw new Error("Email is required — it's how we send you access to your workspace.");

  const projectType = String(formData.get("projectType") ?? "");
  if (!projectType || !(PROJECT_TYPES as readonly string[]).includes(projectType)) {
    throw new Error("Please select what you need help with.");
  }
  const technologyKeys = formData.getAll("technologies").map(String);
  if (technologyKeys.length === 0) throw new Error("Please select at least one service.");

  const { client, magicLinkToken } = await createClientViaIntake({
    organizationId,
    name,
    company: String(formData.get("company") ?? "") || undefined,
    contactEmail,
    contactPhone: String(formData.get("contactPhone") ?? "") || undefined,
    address: String(formData.get("address") ?? "") || undefined,
  });
  revalidatePath("/clients");

  const projectName = String(formData.get("projectName") ?? "").trim() || `${client.name} — ${projectType}`;
  await createProjectWithWorkflow({ organizationId, clientId: client.id, name: projectName, projectType, technologyKeys });

  // Submitting this form live, in this browser, is itself proof of
  // presence — same reasoning signupAction uses to log an agency straight
  // in rather than sending them to /login to type the password they just
  // chose. No email round-trip to wait on for this first visit.
  await setClientSession(client.id);

  if (client.contactEmail) {
    // The client record (and project, if any) are already committed, and
    // they're already logged in via the session above — this email is
    // purely their reference for coming back later, not something the
    // response should wait on. after() runs it once the redirect below
    // has already gone out, so landing in /portal isn't held up by a
    // network round trip to Resend. Server Functions can still call
    // headers() (via getBaseUrl) inside after() — see Next's own docs.
    const contactEmail = client.contactEmail;
    const clientName = client.name;
    after(async () => {
      try {
        const baseUrl = await getBaseUrl();
        const url = `${baseUrl}/api/client-magic/${magicLinkToken}`;
        const { subject, html } = renderClientMagicLinkEmail({ clientName, url, isWelcome: true });
        await sendEmail({ to: contactEmail, subject, html });
      } catch (err) {
        console.error("Welcome email failed to send:", err);
      }
    });
  }

  redirect("/portal");
}

export async function clientLogoutAction() {
  const store = await cookies();
  store.delete(CLIENT_SESSION_COOKIE_NAME);
  redirect("/client-login");
}

/**
 * Public — no session. Always redirects to the same "check your email"
 * outcome regardless of whether a client was actually found — this is
 * the whole point of the generic response (no signal for probing which
 * emails are on file), not an oversight.
 */
export async function requestClientMagicLinkAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (email) {
    const client = await getClientByContactEmail(email);
    if (client?.organizationId) {
      const rateLimit = await checkClientLoginRateLimit(client.id);
      if (rateLimit.allowed) {
        const { token } = await generateClientMagicLink(client.id, client.organizationId);
        await recordClientLoginAttempt(client.id, true);
        // Same reasoning as submitIntakeAction: the "check your email"
        // response is identical either way, so there's nothing to gain
        // by making the redirect wait on Resend's API.
        const clientName = client.name;
        after(async () => {
          try {
            const baseUrl = await getBaseUrl();
            const url = `${baseUrl}/api/client-magic/${token}`;
            const { subject, html } = renderClientMagicLinkEmail({ clientName, url, isWelcome: false });
            await sendEmail({ to: email, subject, html });
          } catch (err) {
            console.error("Magic-link email failed to send:", err);
          }
        });
      }
    }
  }

  redirect(`/client-login?sent=1&email=${encodeURIComponent(email)}`);
}

/**
 * The client-requested fallback for opening the email on a different
 * device than the one signing in — mints a fresh token+code (same call as
 * the link flow, so requesting a code invalidates whatever link email was
 * sent a moment ago, per generateClientMagicLink's own contract) but only
 * ever emails the code, in its own code-only template with no sign-in
 * button. Same generic "check your email" redirect and rate-limiting as
 * requestClientMagicLinkAction — nothing here should let a probing request
 * distinguish "no such email" from "sent."
 */
export async function requestClientMagicCodeAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (email) {
    const client = await getClientByContactEmail(email);
    if (client?.organizationId) {
      const rateLimit = await checkClientLoginRateLimit(client.id);
      if (rateLimit.allowed) {
        const { code } = await generateClientMagicLink(client.id, client.organizationId);
        await recordClientLoginAttempt(client.id, true);
        const clientName = client.name;
        after(async () => {
          try {
            const { subject, html } = renderClientMagicCodeEmail({ clientName, code });
            await sendEmail({ to: email, subject, html });
          } catch (err) {
            console.error("Magic-code email failed to send:", err);
          }
        });
      }
    }
  }

  redirect(`/client-login?sent=1&code=1&email=${encodeURIComponent(email)}`);
}

/**
 * The 6-digit alternative to clicking the emailed link — for opening the
 * email on a different device than the one signing in. Same rate-limiting
 * (scoped by the resolved client, before the code is even checked) and
 * same generic "invalid or expired" outcome as an expired link — never
 * distinguishes "wrong code" from "no such email" or "already used."
 */
export async function verifyClientMagicCodeAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  const back = () => redirect(`/client-login?error=invalid_code&sent=1&code=1&email=${encodeURIComponent(email)}`);
  if (!email || !code) back();

  const client = await getClientByContactEmail(email);
  if (client) {
    const rateLimit = await checkClientLoginRateLimit(client.id);
    if (!rateLimit.allowed) redirect(`/client-login?error=rate_limited&sent=1&code=1&email=${encodeURIComponent(email)}`);
  }

  const result = client ? await verifyClientMagicCode(email, code) : null;
  await recordClientLoginAttempt(client?.id ?? null, !!result);
  if (!result) back();

  await setClientSession(result!.id);
  redirect("/portal");
}

/** Updates the same fields the internal Clients page manages. clientId comes from the client's own session, never request input. */
export async function updateClientPortalInfoAction(formData: FormData) {
  const { clientId } = await requireClientAuth();
  const client = await getClientRecordForSelf(clientId);
  if (!client?.organizationId) throw new Error("This client has no organization assigned yet.");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");

  await updateClient(clientId, client.organizationId, {
    name,
    company: String(formData.get("company") ?? "") || undefined,
    contactEmail: String(formData.get("contactEmail") ?? "") || undefined,
    contactPhone: String(formData.get("contactPhone") ?? "") || undefined,
    address: String(formData.get("address") ?? "") || undefined,
  });
  revalidatePath("/portal");
}

/**
 * Verifies the project belongs to the logged-in client via
 * verifyClientOwnsProjectBySession — never trusts `projectId` from the
 * form alone.
 */
export async function postClientCommentAction(formData: FormData) {
  const { clientId } = await requireClientAuth();
  const projectId = String(formData.get("projectId") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  if (!body) throw new Error("Comment can't be empty");

  const orgId = await verifyClientOwnsProjectBySession(clientId, projectId);
  if (!orgId) throw new Error("You don't have access to that project.");

  // No revalidatePath here: PortalComments already refetches this thread
  // itself right after this action resolves. Calling revalidatePath on the
  // page currently rendering this Server Action forces Next to re-render
  // the WHOLE page inline (including the internal page's own heavy
  // getProjectDetail queries via the other revalidated path below, when
  // this had one) as part of this single response — confirmed as the real
  // cause of repeated "wave 1 timed out" crashes in production, triggered
  // by ordinary chat use, not page load.
  await postProjectMessage(projectId, orgId, CLIENT_ACTOR_NAME, body);
}

/**
 * The Client Workspace's "Review" button. Re-verifies ownership via the
 * session (never trusts projectId/taskId from the form alone) and
 * markClientActionTaskDone() itself re-checks the task is a real client
 * action before writing, so a crafted request can't mark arbitrary work
 * done through this path.
 */
export async function markClientActionDoneAction(formData: FormData) {
  const { clientId } = await requireClientAuth();
  const projectId = String(formData.get("projectId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");

  const orgId = await verifyClientOwnsProjectBySession(clientId, projectId);
  if (!orgId) throw new Error("You don't have access to that project.");

  await markClientActionTaskDone(taskId, projectId, orgId);
  revalidatePath("/portal");
}

export async function uploadClientProjectFileAction(formData: FormData) {
  const { clientId } = await requireClientAuth();
  const projectId = String(formData.get("projectId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Missing file");

  const orgId = await verifyClientOwnsProjectBySession(clientId, projectId);
  if (!orgId) throw new Error("You don't have access to that project.");

  // No revalidatePath — PortalFiles/FilesTab already poll/refetch on their own.
  await uploadProjectAttachment(projectId, orgId, file, { fromClient: true });
}

/**
 * Deletes a file for real, same as the internal Files tab's delete.
 * Deliberately doesn't take a `projectId` from the form; it resolves the
 * attachment's real project itself and checks that against the session, so
 * a client can never delete a file by guessing an id that happens to
 * belong to a different project.
 */
export async function deleteClientFileAction(formData: FormData) {
  const { clientId } = await requireClientAuth();
  const attachmentId = String(formData.get("attachmentId") ?? "");

  const attachmentProjectId = await getAttachmentProjectId(attachmentId);
  // Already gone (a race between this and a poll refetch) is not an error —
  // the end state the caller wants (this file gone) is already true.
  if (!attachmentProjectId) return;
  const orgId = await verifyClientOwnsProjectBySession(clientId, attachmentProjectId);
  if (!orgId) throw new Error("You don't have access to that project.");

  // No revalidatePath — PortalFiles/FilesTab already poll/refetch on their own.
  await removeTaskAttachment(attachmentId, orgId);
}

/** Uploads a file as its own chat message rather than attaching it to whatever's currently typed, so a failed upload never loses draft text. */
export async function uploadClientChatFileAction(formData: FormData) {
  const { clientId } = await requireClientAuth();
  const projectId = String(formData.get("projectId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Missing file");

  const orgId = await verifyClientOwnsProjectBySession(clientId, projectId);
  if (!orgId) throw new Error("You don't have access to that project.");

  // No revalidatePath — PortalComments/MessagesTab already poll/refetch on their own.
  const message = await postProjectMessage(projectId, orgId, CLIENT_ACTOR_NAME, file.name);
  await uploadMessageAttachment(projectId, orgId, message.id, file, { fromClient: true });
}

/** A client may only delete their own messages, never Paul's. */
export async function deleteClientMessageAction(formData: FormData) {
  const { clientId } = await requireClientAuth();
  const messageId = String(formData.get("messageId") ?? "");

  const message = await getMessageOwnership(messageId);
  if (!message) return; // Already deleted — nothing to do.
  if (message.authorName !== CLIENT_ACTOR_NAME) throw new Error("Can't delete this message.");
  const orgId = await verifyClientOwnsProjectBySession(clientId, message.projectId);
  if (!orgId) throw new Error("You don't have access to that project.");

  // No revalidatePath — PortalComments/MessagesTab already poll/refetch on their own.
  await deleteProjectMessage(messageId, orgId);
}

/** Wipes the entire thread for this project, both authors' messages. */
export async function deleteAllClientMessagesAction(formData: FormData) {
  const { clientId } = await requireClientAuth();
  const projectId = String(formData.get("projectId") ?? "");

  const orgId = await verifyClientOwnsProjectBySession(clientId, projectId);
  if (!orgId) throw new Error("You don't have access to that project.");

  // No revalidatePath — the caller already clears its own local state optimistically.
  await deleteAllProjectMessages(projectId, orgId);
}

/** Internal — Paul's reply from the project page's Messages tab. */
export async function postProjectMessageAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  const projectId = String(formData.get("projectId") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  if (!projectId || !body) throw new Error("Message can't be empty");
  // No revalidatePath: MessagesTab already refetches this thread itself
  // right after this action resolves. A Server Action invoked from the
  // page it revalidates forces Next to re-render the WHOLE page inline as
  // part of THIS response — on this page that means re-running every
  // heavy query in getProjectDetail on top of sending one chat message,
  // which was the real, confirmed cause of repeated production timeouts
  // ("wave 1 timed out") triggered by ordinary chat use, not page load.
  await postProjectMessage(projectId, organizationId, await getOrganizationActorName(organizationId), body);
}

/** Internal — uploads a file as its own chat message rather than attaching it to whatever's currently typed. */
export async function uploadChatFileAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  const projectId = String(formData.get("projectId") ?? "");
  const file = formData.get("file");
  if (!projectId || !(file instanceof File)) throw new Error("Missing project or file");

  // No revalidatePath — MessagesTab already polls/refetches on its own.
  const message = await postProjectMessage(projectId, organizationId, await getOrganizationActorName(organizationId), file.name);
  await uploadMessageAttachment(projectId, organizationId, message.id, file);
}

/** Internal — Paul can delete any message, not just his own (he owns the record). */
export async function deleteProjectMessageAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  const messageId = String(formData.get("messageId") ?? "");
  const message = await getMessageOwnership(messageId);
  if (!message) return; // Already deleted — nothing to do.
  // No revalidatePath — MessagesTab already polls/refetches on its own.
  await deleteProjectMessage(messageId, organizationId);
}

export async function deleteAllProjectMessagesAction(projectId: string) {
  const { organizationId } = await requireAuth();
  // No revalidatePath — the caller already clears its own local state optimistically.
  await deleteAllProjectMessages(projectId, organizationId);
}

/**
 * Server Actions can receive File values directly inside FormData — no
 * separate upload API route needed. Validated here (size/type) before ever
 * touching Storage, since this is the one path in the app that accepts
 * arbitrary user-supplied binary content.
 */
export async function uploadTaskAttachmentAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  const taskId = String(formData.get("taskId") ?? "");
  const file = formData.get("file");

  if (!taskId || !(file instanceof File)) {
    throw new Error("Missing task or file");
  }

  const projectId = await uploadTaskAttachment(taskId, organizationId, file);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function uploadProjectFileAction(formData: FormData) {
  const { organizationId } = await requireAuth();
  const projectId = String(formData.get("projectId") ?? "");
  const file = formData.get("file");

  if (!projectId || !(file instanceof File)) {
    throw new Error("Missing project or file");
  }

  // No revalidatePath — FilesTab already refetches on its own right after this.
  await uploadProjectAttachment(projectId, organizationId, file);
}

export async function updateProjectNotesAction(projectId: string, notes: string) {
  const { organizationId } = await requireAuth();
  await updateProjectNotes(projectId, organizationId, notes || null);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function deleteOrganizationAction(id: string) {
  await requirePlatformAdmin();
  await deleteOrganization(id);
  revalidatePath("/admin");
}

export async function restoreOrganizationAction(id: string) {
  await requirePlatformAdmin();
  await restoreOrganization(id);
  revalidatePath("/admin");
}

export async function permanentlyDeleteOrganizationAction(id: string) {
  await requirePlatformAdmin();
  await permanentlyDeleteOrganization(id);
  revalidatePath("/admin");
}
