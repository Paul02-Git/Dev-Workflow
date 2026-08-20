import { createClient } from "@supabase/supabase-js";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/db/client";
import { attachments, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";

// Service-role client, server-only — bypasses RLS by design so uploads work
// from Server Actions without a signed-in Supabase Auth session (this app
// uses its own password gate, not Supabase Auth). Never import this file
// from a "use client" component.
const ATTACHMENTS_BUCKET = "attachments";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_PREFIXES = ["image/", "video/", "application/pdf", "text/plain"];

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase URL/service role key not set");
  return createClient(url, key, { auth: { persistSession: false } });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

async function getTaskProjectId(taskId: string) {
  const [row] = await db.select({ projectId: tasks.projectId }).from(tasks).where(eq(tasks.id, taskId));
  return row?.projectId ?? null;
}

/**
 * Validates and uploads a file into the private "attachments" bucket under
 * the given path prefix. Validated here — this is the one path in the app
 * that accepts arbitrary user-supplied binary content. Shared by both
 * task-scoped and project-scoped attachments; callers insert the DB row
 * themselves since the two cases point at different foreign keys.
 */
async function validateAndUpload(file: File, pathPrefix: string): Promise<string> {
  if (file.size === 0) throw new Error("File is empty");
  if (file.size > MAX_FILE_BYTES) throw new Error("File exceeds 10MB limit");
  if (!ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))) {
    throw new Error(`Unsupported file type: ${file.type || "unknown"}`);
  }

  const path = `${pathPrefix}/${createId()}-${sanitizeFilename(file.name)}`;
  const supabase = getAdminClient();
  const { error } = await supabase.storage.from(ATTACHMENTS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

/** Uploads a task attachment (screenshot, PDF, etc.) and records it. */
export async function uploadTaskAttachment(taskId: string, file: File): Promise<string | null> {
  const path = await validateAndUpload(file, taskId);
  await db.insert(attachments).values({ taskId, storagePath: path, label: file.name, fileSize: file.size });
  return getTaskProjectId(taskId);
}

/** Uploads a general project file (not tied to any specific task) and records it. */
export async function uploadProjectAttachment(projectId: string, file: File): Promise<void> {
  const path = await validateAndUpload(file, `project-${projectId}`);
  await db.insert(attachments).values({ projectId, storagePath: path, label: file.name, fileSize: file.size });
}

/**
 * Deletes one or more objects from the attachments bucket. Best-effort —
 * called after the DB row is already gone, so a Storage-side failure here
 * leaves an orphaned object rather than blocking the (already-successful)
 * delete the user asked for. No-ops on an empty list rather than making a
 * pointless API call.
 */
export async function deleteStorageObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = getAdminClient();
  await supabase.storage.from(ATTACHMENTS_BUCKET).remove(paths);
}

/**
 * Swaps the underlying file on an existing attachment record — e.g. a
 * client sends a revised logo and it should replace the same "Logo" slot
 * rather than becoming a second, separate row. Keeps the row's id and
 * createdAt (when it was first added to the project); only storagePath,
 * label, and fileSize move to the new file. The old storage object is
 * deleted (best-effort) so replacing a file repeatedly doesn't leave
 * orphaned copies behind in the bucket.
 */
export async function replaceAttachment(attachmentId: string, file: File): Promise<string | null> {
  const [existing] = await db.select().from(attachments).where(eq(attachments.id, attachmentId));
  if (!existing) throw new Error("Attachment not found");

  const pathPrefix = existing.taskId ? existing.taskId : `project-${existing.projectId}`;
  const newPath = await validateAndUpload(file, pathPrefix);

  if (existing.storagePath) {
    await deleteStorageObjects([existing.storagePath]);
  }

  await db
    .update(attachments)
    .set({ storagePath: newPath, label: file.name, fileSize: file.size, url: null })
    .where(eq(attachments.id, attachmentId));

  if (existing.projectId) return existing.projectId;
  return existing.taskId ? getTaskProjectId(existing.taskId) : null;
}

/**
 * Signed URL, generated fresh on every render (1 hour expiry) — the bucket
 * is private, so there's no permanent public URL to store or leak.
 */
export async function getSignedAttachmentUrl(storagePath: string): Promise<string | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

/** Ensures the private attachments bucket exists. Safe to call repeatedly. */
export async function ensureAttachmentsBucket(): Promise<void> {
  const supabase = getAdminClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === ATTACHMENTS_BUCKET)) return;
  const { error } = await supabase.storage.createBucket(ATTACHMENTS_BUCKET, { public: false });
  if (error && !error.message.includes("already exists")) {
    throw new Error(`Failed to create attachments bucket: ${error.message}`);
  }
}
