/**
 * Canonical keys for tasks that are genuinely the client's job, not the
 * developer's — used to build the handoff page's "What we need from you"
 * section. Everything else on the launch checklist is internal dev/QA work
 * that happens to be visible for transparency, not something the client
 * needs to act on. Add a key here (same pattern as forgotten-task-rules.ts's
 * RULES array) whenever a template gains a real client-facing action —
 * e.g. "client provides product photos."
 */
export const CLIENT_ACTION_CANONICAL_KEYS = new Set<string>([
  "handoff.client_approval", // cross-cutting.ts — "Get final client approval"
  "handoff.final_approval", // cross-cutting.ts — "Record final sign-off"
]);
