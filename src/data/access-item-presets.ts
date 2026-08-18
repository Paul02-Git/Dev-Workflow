import { AGENCY_EMAIL } from "@/data/agency-info";

/**
 * Standard access items to auto-create when a project is generated, keyed
 * by selected technology. `ownership` documents which of two real models
 * (see PROJECT_STATUS.md) a platform follows in how Paul actually works —
 * "client_invite" (the client owns the account, e.g. their Shopify store —
 * Paul needs *them* to add him) vs. "self_created" (Paul creates it
 * himself under his own agency access, e.g. Cloudways, GA4 — ownership
 * transfers to the client later at handoff, tracked separately by the
 * workflow engine's `handoff.*_ownership` tasks). It's descriptive only:
 * every access item starts NOT_REQUESTED regardless of `ownership` — Paul
 * marks each one connected explicitly once it's actually set up, rather
 * than the app assuming a self-created one is already done on day one.
 */
export type AccessItemPreset = {
  name: string;
  defaultRole: string;
  ownership: "client_invite" | "self_created";
  instructions: string;
};

const inviteInstructions = (where: string, role: string) =>
  `Ask the client to add ${AGENCY_EMAIL} as ${role} ${where}.`;

export const ACCESS_ITEM_PRESETS: Record<string, AccessItemPreset[]> = {
  wordpress: [
    {
      name: "WordPress Admin",
      defaultRole: "Administrator",
      ownership: "self_created",
      instructions: "Created via Cloudways during setup — access is already in place. Ownership hands to the client at project handoff.",
    },
    {
      name: "Cloudways",
      defaultRole: "Full access",
      ownership: "self_created",
      instructions: "Your own Cloudways account/app — no client action needed.",
    },
  ],
  shopify: [
    {
      name: "Shopify Admin",
      defaultRole: "Staff account",
      ownership: "client_invite",
      instructions: inviteInstructions("as a Staff account in Settings → Users and permissions", "an Administrator"),
    },
  ],
  ga4: [
    {
      name: "GA4",
      defaultRole: "Administrator",
      ownership: "self_created",
      instructions: "Property created under your agency Google account — access is already in place. Ownership hands to the client at project handoff.",
    },
  ],
  gtm: [
    {
      name: "Google Tag Manager",
      defaultRole: "Administrator",
      ownership: "self_created",
      instructions: "Container created under your agency Google account — access is already in place. Ownership hands to the client at project handoff.",
    },
  ],
  gsc: [
    {
      name: "Google Search Console",
      defaultRole: "Owner",
      ownership: "self_created",
      instructions: "Verified under your agency Google account — access is already in place. Ownership hands to the client at project handoff.",
    },
  ],
  clarity: [
    {
      name: "Microsoft Clarity",
      defaultRole: "Admin",
      ownership: "self_created",
      instructions: "Created under your agency Microsoft account — access is already in place. Ownership hands to the client at project handoff.",
    },
  ],
  klaviyo: [
    {
      name: "Klaviyo",
      defaultRole: "Admin",
      ownership: "client_invite",
      instructions: inviteInstructions("as a User under Account → Users", "an Admin/Manager"),
    },
  ],
  printify: [
    {
      name: "Printify",
      defaultRole: "Team member",
      ownership: "client_invite",
      instructions: inviteInstructions("as a team member on their Printify account", "a team member"),
    },
  ],
  ghl: [
    {
      name: "GoHighLevel",
      defaultRole: "Admin",
      ownership: "client_invite",
      instructions: inviteInstructions("as a User under Settings → My Staff", "an Admin"),
    },
  ],
  meta_ads: [
    {
      name: "Meta Business Manager",
      defaultRole: "Partner (Admin)",
      ownership: "client_invite",
      instructions: inviteInstructions("as a Partner in Business Settings → Partners, with Admin access to the ad account", "a Partner"),
    },
  ],
};

// Always relevant regardless of tech stack.
export const ALWAYS_INCLUDED_ACCESS_ITEMS: AccessItemPreset[] = [
  {
    name: "Domain Registrar",
    defaultRole: "Full access",
    ownership: "self_created",
    instructions: "Agency GoDaddy access covers most domains. If this one's registered elsewhere, ask the client for registrar access instead.",
  },
];

export function accessItemPresetsForTechnologies(technologyKeys: string[]): AccessItemPreset[] {
  const byName = new Map<string, AccessItemPreset>();
  for (const preset of ALWAYS_INCLUDED_ACCESS_ITEMS) byName.set(preset.name, preset);
  for (const key of technologyKeys) {
    for (const preset of ACCESS_ITEM_PRESETS[key] ?? []) byName.set(preset.name, preset);
  }
  return Array.from(byName.values());
}

/**
 * Every known preset across every technology, deduped by name — the
 * catalog behind the Accounts & Access "+ Add platform" quick-add picker.
 * Deliberately not scoped to this project's selected technologies: a
 * client can hand over access to something outside the original tech
 * selection (e.g. a Facebook account on a project that didn't select Meta
 * Ads at creation time).
 */
export const ALL_ACCESS_ITEM_PRESETS: AccessItemPreset[] = (() => {
  const byName = new Map<string, AccessItemPreset>();
  for (const preset of ALWAYS_INCLUDED_ACCESS_ITEMS) byName.set(preset.name, preset);
  for (const presets of Object.values(ACCESS_ITEM_PRESETS)) {
    for (const preset of presets) byName.set(preset.name, preset);
  }
  return Array.from(byName.values());
})();
