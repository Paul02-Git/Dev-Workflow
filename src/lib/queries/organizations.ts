import { db } from "@/db/client";
import { organizations, clients, projects } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { hashPassword, requireAuth } from "@/lib/auth";

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

// ---------------------------------------------------------------------------
// Platform admin — read-only cross-organization oversight, Dovera only.
// See organizations.isPlatformAdmin's comment in schema.ts for why this is
// checked fresh from the DB on every call rather than trusted from the
// session cookie.
// ---------------------------------------------------------------------------

/**
 * Guards every /admin route and action. Throws (matching requireAuth's own
 * behavior — this app's established "just throw, let the caller decide
 * how to present it" convention) if the caller's organization isn't
 * flagged as the platform admin. Returns that organization's id, mirroring
 * requireAuth's own return shape, so callers that need it don't have to
 * call requireAuth() a second time.
 */
export async function requirePlatformAdmin(): Promise<{ organizationId: string }> {
  const { organizationId } = await requireAuth();
  const [org] = await db.select({ isPlatformAdmin: organizations.isPlatformAdmin }).from(organizations).where(eq(organizations.id, organizationId));
  if (!org?.isPlatformAdmin) throw new Error("Not authorized");
  return { organizationId };
}

/** Every organization on the platform, with basic counts — the /admin overview list. Read-only: no client/project/task detail, just enough to see who's using the product. */
export async function listAllOrganizationsForAdmin() {
  const [orgs, clientCounts, projectCounts] = await Promise.all([
    db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, createdAt: organizations.createdAt })
      .from(organizations)
      .orderBy(organizations.createdAt),
    db
      .select({ organizationId: clients.organizationId, count: sql<number>`count(*)` })
      .from(clients)
      .groupBy(clients.organizationId),
    db
      .select({ organizationId: projects.organizationId, count: sql<number>`count(*)` })
      .from(projects)
      .groupBy(projects.organizationId),
  ]);

  const clientCountByOrg = new Map(clientCounts.map((r) => [r.organizationId, Number(r.count)]));
  const projectCountByOrg = new Map(projectCounts.map((r) => [r.organizationId, Number(r.count)]));

  return orgs.map((org) => ({
    ...org,
    clientCount: clientCountByOrg.get(org.id) ?? 0,
    projectCount: projectCountByOrg.get(org.id) ?? 0,
  }));
}

/** Cheap check for whether to show the Admin nav link at all — the actual security boundary is requirePlatformAdmin(), called again by every /admin page/action; this is just for the sidebar's own conditional rendering. */
export async function isPlatformAdminOrg(organizationId: string): Promise<boolean> {
  const [org] = await db.select({ isPlatformAdmin: organizations.isPlatformAdmin }).from(organizations).where(eq(organizations.id, organizationId));
  return !!org?.isPlatformAdmin;
}

/** One organization's own record, for the /admin drill-down page's header. */
export async function getOrganizationById(id: string) {
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, createdAt: organizations.createdAt })
    .from(organizations)
    .where(eq(organizations.id, id));
  return org ?? null;
}
