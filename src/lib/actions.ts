"use server";

import { revalidatePath } from "next/cache";
import { createClient, deleteClient } from "@/lib/queries/clients";
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
import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ALL_ACCESS_ITEM_PRESETS } from "@/data/access-item-presets";
import { searchAll, type SearchResult } from "@/lib/queries/search";
import { bulkUpdateTaskStatus } from "@/lib/queries/projects";
import {
  createMaintenancePlan,
  updateMaintenancePlan,
  deleteMaintenancePlan,
  generateMaintenanceRun,
} from "@/lib/queries/maintenance";
import { generateHandoffLink, revokeHandoffLink } from "@/lib/queries/projects";
import { uploadTaskAttachment, uploadProjectAttachment, replaceAttachment } from "@/lib/storage";

export async function createClientAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Client name is required");

  const client = await createClient({
    name,
    company: String(formData.get("company") ?? "") || undefined,
    contactEmail: String(formData.get("contactEmail") ?? "") || undefined,
    contactPhone: String(formData.get("contactPhone") ?? "") || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
  });

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function createProjectAction(formData: FormData) {
  let clientId = String(formData.get("clientId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const projectType = String(formData.get("projectType") ?? "");
  const technologyKeys = formData.getAll("technologies").map(String);

  if (clientId === "__new__") {
    const newClientName = String(formData.get("newClientName") ?? "").trim();
    if (!newClientName) throw new Error("New client name is required");

    const newClient = await createClient({
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
    clientId,
    name,
    projectType,
    technologyKeys,
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateTaskStatusAction(taskId: string, status: string) {
  const task = await updateTaskStatus(taskId, status);
  if (task) {
    revalidatePath(`/projects/${task.projectId}`);
    revalidatePath("/dashboard");
  }
}

/** "Start Task" on the dashboard's Command Center panel — marks the task in progress and refreshes both pages. */
export async function startDashboardTaskAction(taskId: string) {
  const task = await updateTaskStatus(taskId, "IN_PROGRESS");
  if (task) {
    revalidatePath("/dashboard");
    revalidatePath(`/projects/${task.projectId}`);
  }
}

export async function updateTaskDetailsAction(
  taskId: string,
  input: { notes?: string | null; dueDate?: string | null; assignee?: string | null }
) {
  const task = await updateTaskDetails(taskId, {
    notes: input.notes,
    dueDate: input.dueDate ? new Date(input.dueDate) : input.dueDate === "" ? null : undefined,
    assignee: input.assignee,
  });
  if (task) revalidatePath(`/projects/${task.projectId}`);
}

export async function setTaskWaitingOnClientAction(taskId: string, waiting: boolean) {
  const projectId = await setTaskWaitingOnClient(taskId, waiting);
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/dashboard");
  }
}

export async function addTaskTagAction(taskId: string, tagName: string) {
  const projectId = await addTaskTag(taskId, tagName);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function removeTaskTagAction(taskId: string, tagId: string) {
  const projectId = await removeTaskTag(taskId, tagId);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function addTaskAttachmentAction(taskId: string, url: string, label: string) {
  const projectId = await addTaskAttachment(taskId, { url, label });
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function removeTaskAttachmentAction(attachmentId: string) {
  const projectId = await removeTaskAttachment(attachmentId);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function bulkRemoveAttachmentsAction(attachmentIds: string[]) {
  const projectIds = await bulkRemoveAttachments(attachmentIds);
  for (const id of projectIds) revalidatePath(`/projects/${id}`);
}

export async function replaceAttachmentAction(formData: FormData) {
  const attachmentId = String(formData.get("attachmentId") ?? "");
  const file = formData.get("file");
  if (!attachmentId || !(file instanceof File)) {
    throw new Error("Missing attachment or file");
  }
  const projectId = await replaceAttachment(attachmentId, file);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function deleteProjectAction(projectId: string) {
  await deleteProject(projectId);
  revalidatePath("/projects");
  revalidatePath("/clients");
  redirect("/projects");
}

export async function deleteClientAction(clientId: string) {
  await deleteClient(clientId);
  revalidatePath("/clients");
  redirect("/clients");
}

export async function createTaskAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const stageKey = String(formData.get("stageKey") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const priority = String(formData.get("priority") ?? "MEDIUM");
  const isCritical = formData.get("isCritical") === "on";

  if (!projectId || !stageKey || !title) {
    throw new Error("Stage and title are required");
  }

  await createAdHocTask({ projectId, stageKey, title, priority, isCritical });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function updateProjectOverviewAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const domain = String(formData.get("domain") ?? "").trim();
  const targetLaunchDate = String(formData.get("targetLaunchDate") ?? "").trim();

  if (!projectId) throw new Error("Missing project");

  await updateProjectOverview(projectId, {
    domain: domain || null,
    targetLaunchDate: targetLaunchDate ? new Date(targetLaunchDate) : null,
  });
  revalidatePath(`/projects/${projectId}`);
}

export async function updateProjectStatusAction(projectId: string, status: string) {
  await updateProjectStatus(projectId, status);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export async function createAccessItemAction(formData: FormData) {
  await requireAuth();
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!projectId || !name) throw new Error("Name is required");

  await createAccessItem({ projectId, name, url, role, instructions, username, password });
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
  await requireAuth();
  const preset = ALL_ACCESS_ITEM_PRESETS.find((p) => p.name === presetName);
  if (!preset) throw new Error("Unknown platform preset");

  await createAccessItem({
    projectId,
    name: preset.name,
    role: preset.defaultRole,
    instructions: preset.instructions,
    status: "NOT_REQUESTED",
  });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function updateAccessItemStatusAction(accessItemId: string, projectId: string, status: string) {
  await requireAuth();
  await updateAccessItem(accessItemId, { status });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function updateAccessItemDetailsAction(formData: FormData) {
  await requireAuth();
  const accessItemId = String(formData.get("accessItemId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();

  if (!accessItemId || !name) throw new Error("Missing access item or name");

  await updateAccessItem(accessItemId, { name, url: url || null, role: role || null, instructions: instructions || null });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function clearAccessItemCredentialsAction(accessItemId: string, projectId: string) {
  await requireAuth();
  await clearAccessItemCredentials(accessItemId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function setAccessItemCredentialsAction(formData: FormData) {
  await requireAuth();
  const accessItemId = String(formData.get("accessItemId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!accessItemId) throw new Error("Missing access item");

  await setAccessItemCredentials(accessItemId, { username, password: password || undefined });
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
  await requireAuth();
  return revealAccessItemPassword(accessItemId);
}

export async function deleteAccessItemAction(accessItemId: string) {
  await requireAuth();
  const projectId = await deleteAccessItem(accessItemId);
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/dashboard");
  }
}

export async function searchAction(query: string): Promise<SearchResult[]> {
  return searchAll(query);
}

export async function bulkUpdateTaskStatusAction(taskIds: string[], status: string) {
  const projectIds = await bulkUpdateTaskStatus(taskIds, status);
  for (const id of projectIds) revalidatePath(`/projects/${id}`);
  revalidatePath("/tasks");
  revalidatePath("/today");
  revalidatePath("/dashboard");
}

export async function createMaintenancePlanAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const cadenceDays = Number(formData.get("cadenceDays") ?? 30);
  const checklistTemplate = String(formData.get("checklistTemplate") ?? "").trim();

  if (!projectId || !name || !checklistTemplate) {
    throw new Error("Project, name, and checklist are required");
  }

  await createMaintenancePlan({ projectId, name, cadenceDays, checklistTemplate });
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
}

export async function updateMaintenancePlanAction(
  planId: string,
  input: { isActive?: boolean; cadenceDays?: number; checklistTemplate?: string; name?: string }
) {
  await updateMaintenancePlan(planId, input);
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
}

export async function deleteMaintenancePlanAction(planId: string) {
  await deleteMaintenancePlan(planId);
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
}

export async function generateMaintenanceRunAction(planId: string) {
  const projectId = await generateMaintenanceRun(planId);
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function generateHandoffLinkAction(projectId: string) {
  const token = await generateHandoffLink(projectId);
  revalidatePath(`/projects/${projectId}`);
  return token;
}

export async function revokeHandoffLinkAction(projectId: string) {
  await revokeHandoffLink(projectId);
  revalidatePath(`/projects/${projectId}`);
}

/**
 * Server Actions can receive File values directly inside FormData — no
 * separate upload API route needed. Validated here (size/type) before ever
 * touching Storage, since this is the one path in the app that accepts
 * arbitrary user-supplied binary content.
 */
export async function uploadTaskAttachmentAction(formData: FormData) {
  const taskId = String(formData.get("taskId") ?? "");
  const file = formData.get("file");

  if (!taskId || !(file instanceof File)) {
    throw new Error("Missing task or file");
  }

  const projectId = await uploadTaskAttachment(taskId, file);
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function uploadProjectFileAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const file = formData.get("file");

  if (!projectId || !(file instanceof File)) {
    throw new Error("Missing project or file");
  }

  await uploadProjectAttachment(projectId, file);
  revalidatePath(`/projects/${projectId}`);
}

export async function updateProjectNotesAction(projectId: string, notes: string) {
  await updateProjectNotes(projectId, notes || null);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/dashboard");
}
