import { db } from "@/db/client";
import { accessItems } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";

/**
 * Deliberately never selects passwordEncrypted — the ciphertext shouldn't
 * be sent to the client at all on a normal page load, only fetched
 * on-demand via revealAccessItemPassword when the user explicitly clicks
 * reveal. hasPassword tells the UI whether to show the reveal icon.
 */
export async function listAccessItems(projectId: string, organizationId: string) {
  return db
    .select({
      id: accessItems.id,
      name: accessItems.name,
      url: accessItems.url,
      role: accessItems.role,
      instructions: accessItems.instructions,
      grantedAt: accessItems.grantedAt,
      username: accessItems.username,
      status: accessItems.status,
      notes: accessItems.notes,
      hasPassword: sql<boolean>`${accessItems.passwordEncrypted} is not null`,
    })
    .from(accessItems)
    .where(and(eq(accessItems.projectId, projectId), eq(accessItems.organizationId, organizationId)))
    // Items batch-inserted together (project creation, quick-add presets)
    // often share the exact same createdAt millisecond — id is a stable
    // tiebreaker so the list order can never change after an UPDATE
    // (e.g. changing status), which is what "createdAt alone" was doing.
    .orderBy(accessItems.createdAt, accessItems.id);
}

export async function createAccessItem(input: {
  organizationId: string;
  projectId: string;
  name: string;
  url?: string;
  role?: string;
  instructions?: string;
  status?: string;
  username?: string;
  password?: string;
}) {
  const status = (input.status as (typeof accessItems.$inferInsert)["status"] | undefined) ?? "NOT_REQUESTED";
  const [item] = await db
    .insert(accessItems)
    .values({
      organizationId: input.organizationId,
      projectId: input.projectId,
      name: input.name,
      url: input.url || undefined,
      role: input.role || undefined,
      instructions: input.instructions || undefined,
      status,
      grantedAt: status === "GRANTED" || status === "VERIFIED" ? new Date() : undefined,
      username: input.username || undefined,
      passwordEncrypted: input.password ? encrypt(input.password) : undefined,
    })
    .returning({ id: accessItems.id, projectId: accessItems.projectId });
  return item;
}

/**
 * Stamps grantedAt the first time status moves to GRANTED or VERIFIED —
 * never overwritten by a later status change, mirroring how
 * projects.launchedAt only stamps once (see updateProjectStatus).
 */
export async function updateAccessItem(
  id: string,
  organizationId: string,
  input: { name?: string; url?: string | null; role?: string | null; instructions?: string | null; status?: string; notes?: string | null }
) {
  const { status, ...rest } = input;
  const patch: Partial<typeof accessItems.$inferInsert> = { ...rest, updatedAt: new Date() };
  if (status) {
    patch.status = status as (typeof accessItems.$inferInsert)["status"];
    if (status === "GRANTED" || status === "VERIFIED") {
      const [current] = await db
        .select({ grantedAt: accessItems.grantedAt })
        .from(accessItems)
        .where(and(eq(accessItems.id, id), eq(accessItems.organizationId, organizationId)));
      if (!current?.grantedAt) patch.grantedAt = new Date();
    }
  }

  const [item] = await db
    .update(accessItems)
    .set(patch)
    .where(and(eq(accessItems.id, id), eq(accessItems.organizationId, organizationId)))
    .returning();
  return item;
}

/** Removes stored username/password entirely, without deleting the access item itself. */
export async function clearAccessItemCredentials(id: string, organizationId: string): Promise<void> {
  await db
    .update(accessItems)
    .set({ username: null, passwordEncrypted: null, updatedAt: new Date() })
    .where(and(eq(accessItems.id, id), eq(accessItems.organizationId, organizationId)));
}

/**
 * Sets username/password. A blank password leaves the existing one
 * untouched (mirrors "leave blank to keep current password" conventions) —
 * use clearAccessItemCredentials to remove stored credentials entirely.
 */
export async function setAccessItemCredentials(id: string, organizationId: string, input: { username?: string; password?: string }) {
  const [row] = await db
    .select({ projectId: accessItems.projectId })
    .from(accessItems)
    .where(and(eq(accessItems.id, id), eq(accessItems.organizationId, organizationId)));

  const patch: Partial<typeof accessItems.$inferInsert> = { updatedAt: new Date() };
  if (input.username !== undefined) patch.username = input.username || null;
  if (input.password) patch.passwordEncrypted = encrypt(input.password);

  await db.update(accessItems).set(patch).where(and(eq(accessItems.id, id), eq(accessItems.organizationId, organizationId)));
  return row?.projectId ?? null;
}

/** Decrypts on demand. Callers must have already verified the session. */
export async function revealAccessItemPassword(id: string, organizationId: string): Promise<string | null> {
  const [row] = await db
    .select({ passwordEncrypted: accessItems.passwordEncrypted })
    .from(accessItems)
    .where(and(eq(accessItems.id, id), eq(accessItems.organizationId, organizationId)));
  if (!row?.passwordEncrypted) return null;
  return decrypt(row.passwordEncrypted);
}

export async function deleteAccessItem(id: string, organizationId: string) {
  const [row] = await db
    .select({ projectId: accessItems.projectId })
    .from(accessItems)
    .where(and(eq(accessItems.id, id), eq(accessItems.organizationId, organizationId)));
  await db.delete(accessItems).where(and(eq(accessItems.id, id), eq(accessItems.organizationId, organizationId)));
  return row?.projectId ?? null;
}
