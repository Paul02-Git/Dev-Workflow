import { randomBytes } from "crypto";
import { db } from "@/db/client";
import { organizations, clients, projects, tags, taskTags, loginAttempts } from "@/db/schema";
import { and, eq, isNull, notInArray, sql } from "drizzle-orm";
import { hashPassword, requireAuth } from "@/lib/auth";
import { deleteProject } from "@/lib/queries/projects";
import { deleteClient } from "@/lib/queries/clients";
import { normalizeSlug } from "@/lib/slug";

const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function getOrganizationBySlug(slug: string) {
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(and(eq(organizations.slug, slug), isNull(organizations.deletedAt)));
  return org ?? null;
}

/** Powers "Sign in with Google" (see src/lib/google-oauth.ts) — looks up an org by its linked email. Caller must have already confirmed the Google profile's email_verified is true before calling this. */
export async function getOrganizationByVerifiedEmail(email: string): Promise<{ id: string; name: string } | null> {
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(and(eq(organizations.email, email.trim().toLowerCase()), isNull(organizations.deletedAt)));
  return org ?? null;
}

/**
 * Same lookup as getOrganizationByVerifiedEmail, but includes soft-deleted
 * orgs and surfaces deletedAt — lets the Google OAuth callback route tell
 * "no account at all" apart from "account exists but was deactivated" so
 * it can send the latter to /account-deactivated with a clear explanation
 * instead of the generic "no account linked" message.
 */
export async function getOrganizationByEmailIncludingDeleted(
  email: string
): Promise<{ id: string; name: string; deletedAt: Date | null } | null> {
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, deletedAt: organizations.deletedAt })
    .from(organizations)
    .where(eq(organizations.email, email.trim().toLowerCase()));
  return org ?? null;
}

// Raw existence checks, deliberately ignoring deletedAt — unlike
// getOrganizationBySlug/getOrganizationByVerifiedEmail above. Both `slug`
// and `email` are DB-level UNIQUE columns that a soft-deleted org's row
// still occupies (that's the whole point of the 30-day grace window: the
// row, and its identity, still really exists until restored or
// permanently purged) — so a signup availability check that filters out
// soft-deleted orgs can wrongly report a slug/email as free and then hit
// a raw unique-constraint violation on insert. Used only for "can a new
// org claim this" checks; every other lookup in this file still correctly
// scopes to isNull(deletedAt), since a deleted org shouldn't be findable
// for login/display purposes.
async function isSlugTaken(slug: string): Promise<boolean> {
  const [row] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug));
  return !!row;
}

async function isEmailTaken(email: string): Promise<boolean> {
  const [row] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.email, email));
  return !!row;
}

/**
 * Creates a new organization (agency) from just an email + password — the
 * onboarding path for anyone other than Dovera (organization #1, migrated
 * in directly). No separate agency-name field: login is email-based now,
 * so the org's display name and slug (a purely internal/admin-facing
 * identifier — never typed again, never shown as a login credential) are
 * both derived from the email's local part (e.g. "paul@doveraagency.com"
 * -> name "paul", slug "paul"), same as createOrganizationFromGoogle
 * derives from a Google profile name. Slug collisions are resolved with a
 * random suffix rather than failing, for the same reason — there's no
 * form field for a user to pick a different one on. Email uniqueness is
 * still enforced and surfaced ("email_taken") since email is the real
 * login credential. Starts with a completely empty slate: no
 * clients/projects, same as any other org would after this.
 */
export async function createOrganizationFromEmail(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (await isEmailTaken(email)) throw new Error("email_taken");

  const localPart = email.split("@")[0] || "agency";
  let slug = normalizeSlug(localPart) || "agency";
  if (await isSlugTaken(slug)) slug = `${slug}-${randomBytes(3).toString("hex")}`;

  const [org] = await db
    .insert(organizations)
    .values({ name: localPart, slug, passwordHash: hashPassword(input.password), email })
    .returning({ id: organizations.id, name: organizations.name, slug: organizations.slug });
  return org;
}

/**
 * Auto-provisions a brand-new organization from a verified Google profile
 * — the "sign up with Google" path (see the callback route's `signup`
 * intent). No password is ever chosen by the user for this account; a
 * random one is generated and hashed purely to satisfy the NOT NULL
 * column, since Google is this account's login method going forward.
 * Slug collisions are resolved with a random suffix rather than failing —
 * there's no form here for the user to pick a different name on.
 */
export async function createOrganizationFromGoogle(input: { name: string; email: string }) {
  let slug = normalizeSlug(input.name) || "agency";
  if (await isSlugTaken(slug)) slug = `${slug}-${randomBytes(3).toString("hex")}`;

  const [org] = await db
    .insert(organizations)
    .values({
      name: input.name,
      slug,
      passwordHash: hashPassword(randomBytes(32).toString("hex")),
      email: input.email.trim().toLowerCase(),
    })
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

/**
 * Every OTHER organization on the platform, with basic counts — the
 * /admin overview list. Excludes platform-admin organizations themselves
 * (Dovera) — this is oversight of customers using the product, not a
 * listing that includes the platform owner's own account. Read-only: no
 * client/project/task detail, just enough to see who's using the product.
 */
export async function listAllOrganizationsForAdmin() {
  const [orgs, clientCounts, projectCounts] = await Promise.all([
    db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, createdAt: organizations.createdAt })
      .from(organizations)
      .where(and(eq(organizations.isPlatformAdmin, false), isNull(organizations.deletedAt)))
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

export async function listDeletedOrganizationsForAdmin() {
  const orgs = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, deletedAt: organizations.deletedAt })
    .from(organizations)
    .where(and(eq(organizations.isPlatformAdmin, false), sql`${organizations.deletedAt} is not null`))
    .orderBy(organizations.deletedAt);

  const now = Date.now();
  return orgs.map((org) => {
    const purgeEligibleAt = new Date(org.deletedAt!.getTime() + PURGE_AFTER_MS);
    return { ...org, purgeEligibleAt, eligible: purgeEligibleAt.getTime() <= now };
  });
}

export async function deleteOrganization(id: string): Promise<void> {
  const [org] = await db.select({ isPlatformAdmin: organizations.isPlatformAdmin }).from(organizations).where(eq(organizations.id, id));
  if (!org) throw new Error("Organization not found");
  if (org.isPlatformAdmin) throw new Error("Can't delete the platform admin organization");
  await db.update(organizations).set({ deletedAt: new Date() }).where(eq(organizations.id, id));
}

export async function restoreOrganization(id: string): Promise<void> {
  await db.update(organizations).set({ deletedAt: null }).where(eq(organizations.id, id));
}

/**
 * Refuses unless the org is soft-deleted first (still must go through
 * deleteOrganization before this — no skipping straight from active to
 * gone). The 30-day window shown in the admin UI is informational, not a
 * hard gate here: platform admin can trigger this immediately on any
 * already-deleted org, since this whole function is already restricted to
 * requirePlatformAdmin callers. No FK on this schema cascades from
 * organizationId, so this walks the tree with the same delete functions
 * every other org-scoped deletion already uses, then cleans up the two
 * tables nothing else reaches (org-level login_attempts, orphaned tags),
 * then removes the org row itself.
 */
export async function permanentlyDeleteOrganization(id: string): Promise<void> {
  const [org] = await db.select({ deletedAt: organizations.deletedAt }).from(organizations).where(eq(organizations.id, id));
  if (!org?.deletedAt) throw new Error("Organization is not deleted");

  const orgProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.organizationId, id));
  for (const p of orgProjects) await deleteProject(p.id, id);

  const orgClients = await db.select({ id: clients.id }).from(clients).where(eq(clients.organizationId, id));
  for (const c of orgClients) await deleteClient(c.id, id);

  await db.delete(loginAttempts).where(eq(loginAttempts.organizationId, id));

  const usedTagIds = db.selectDistinct({ tagId: taskTags.tagId }).from(taskTags);
  await db.delete(tags).where(and(eq(tags.organizationId, id), notInArray(tags.id, usedTagIds)));

  await db.delete(organizations).where(eq(organizations.id, id));
}

/**
 * One organization's own record, for the /admin drill-down page's header.
 * Returns null for a platform-admin organization (Dovera) even if its id
 * is navigated to directly — the drill-down is for inspecting customers,
 * not the platform owner's own account, same exclusion as the overview
 * list above.
 */
export async function getOrganizationById(id: string) {
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, createdAt: organizations.createdAt, isPlatformAdmin: organizations.isPlatformAdmin })
    .from(organizations)
    .where(eq(organizations.id, id));
  if (!org || org.isPlatformAdmin) return null;
  return { id: org.id, name: org.name, slug: org.slug, createdAt: org.createdAt };
}
