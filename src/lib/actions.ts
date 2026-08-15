"use server";

import { revalidatePath } from "next/cache";
import { createClient, deleteClient } from "@/lib/queries/clients";
import {
  createProjectWithWorkflow,
  updateTaskStatus,
  getProjectIssues,
  updateTaskDetails,
  addTaskTag,
  removeTaskTag,
  addTaskAttachment,
  removeTaskAttachment,
  deleteProject,
} from "@/lib/queries/projects";
import { redirect } from "next/navigation";

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
  }
}

export async function checkProjectAction(projectId: string) {
  return getProjectIssues(projectId);
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
