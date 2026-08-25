// Used to auto-fill "who to invite" in access-request instructions.
export const AGENCY_EMAIL = "paul@doveraagency.com";

// The non-agency side of activity logging — a client's contactEmail isn't
// always on file and clients don't have their own accounts, so this stays
// a plain constant. The agency side used to be a matching hardcoded
// constant here too, but now that multiple organizations exist it's
// resolved dynamically per organization instead — see
// getOrganizationActorName in src/lib/auth.ts.
export const CLIENT_ACTOR_NAME = "Client";
