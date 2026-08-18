// Used to auto-fill "who to invite" in access-request instructions.
export const AGENCY_EMAIL = "paul@doveraagency.com";

// Single source of truth for "who did this" in activity logging. There's
// no user-accounts table yet (this is a single shared-password app), so
// every activity write passes one of these two plain name strings rather
// than a userId — swapping in a real auth-derived name later is a
// one-line change per call site, not a redesign.
export const AGENCY_OWNER_NAME = "Paul";
export const CLIENT_ACTOR_NAME = "Client";
