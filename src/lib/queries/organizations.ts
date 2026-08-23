import { db } from "@/db/client";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

/** Lowercase letters, digits, and hyphens only — matches the login page's own "your-agency-slug" convention. Not a security boundary (the password is), just keeps URLs/login readable. */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getOrganizationBySlug(slug: string) {
  const [org] = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.slug, slug));
  return org ?? null;
}

/**
 * Creates a new organization (agency) — the onboarding path for anyone
 * other than Dovera (organization #1, migrated in directly). Starts with a
 * completely empty slate: no clients/projects, same as any other org would
 * after this. Throws if the slug is already taken — checked explicitly
 * first rather than relying on the unique constraint's error shape, so the
 * caller gets a clean, predictable message either way.
 */
export async function createOrganization(input: { name: string; slug: string; password: string }) {
  const existing = await getOrganizationBySlug(input.slug);
  if (existing) throw new Error("That organization URL is already taken — pick another.");

  const [org] = await db
    .insert(organizations)
    .values({ name: input.name, slug: input.slug, passwordHash: hashPassword(input.password) })
    .returning({ id: organizations.id, name: organizations.name, slug: organizations.slug });
  return org;
}
