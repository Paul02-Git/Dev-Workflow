/**
 * Lowercase letters, digits, and hyphens only — matches the login page's
 * own "your-agency-slug" convention. Not a security boundary (the
 * password is), just keeps URLs/login readable. Pulled out into its own
 * dependency-free module (was in queries/organizations.ts, a server-only
 * file) so the signup form's live slug preview can import it directly
 * without dragging DB code into the client bundle.
 */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
