import { randomBytes } from "crypto";
import { db } from "@/db/client";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";

/** One reusable, per-organization "New Client Intake" link — not per-client, unlike handoff/portal tokens. */
export async function getIntakeToken(organizationId: string): Promise<string | null> {
  const [row] = await db.select({ intakeToken: organizations.intakeToken }).from(organizations).where(eq(organizations.id, organizationId));
  return row?.intakeToken ?? null;
}

export async function generateIntakeToken(organizationId: string): Promise<string> {
  const existing = await getIntakeToken(organizationId);
  if (existing) return existing;
  const token = randomBytes(24).toString("hex");
  await db.update(organizations).set({ intakeToken: token }).where(eq(organizations.id, organizationId));
  return token;
}

export async function revokeIntakeToken(organizationId: string): Promise<void> {
  await db.update(organizations).set({ intakeToken: null }).where(eq(organizations.id, organizationId));
}

/** Resolves an intake token to the organization it belongs to, or null if it doesn't match any organization's current token. */
export async function resolveIntakeToken(token: string): Promise<{ organizationId: string; organizationName: string } | null> {
  const [row] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.intakeToken, token));
  return row ? { organizationId: row.id, organizationName: row.name } : null;
}
