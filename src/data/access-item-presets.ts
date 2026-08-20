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

// Preset objects are defined once and referenced from every technology
// bundle that needs them (e.g. GA4_PRESET appears under both "ga4" and
// "wordpress") — accessItemPresetsForTechnologies dedupes by name, so
// reusing the same object avoids two copies of the same platform's
// role/instructions drifting apart.
const WORDPRESS_ADMIN_PRESET: AccessItemPreset = {
  name: "WordPress Admin",
  defaultRole: "Administrator",
  ownership: "self_created",
  instructions: "Created via Cloudways during setup — access is already in place. Ownership hands to the client at project handoff.",
};
const CLOUDWAYS_PRESET: AccessItemPreset = {
  name: "Cloudways",
  defaultRole: "Full access",
  ownership: "self_created",
  instructions: "Your own Cloudways account/app — no client action needed.",
};
const ELEMENTOR_PRESET: AccessItemPreset = {
  name: "Elementor Pro",
  defaultRole: "License",
  ownership: "self_created",
  instructions: "Activated with your agency Elementor Pro license inside WP Admin — no separate login, no client action needed.",
};
const FIGMA_PRESET: AccessItemPreset = {
  name: "Figma",
  defaultRole: "Editor",
  ownership: "self_created",
  instructions: "Your own Figma account/files — no client action needed. Share a view/comment link when design review is needed.",
};
const SHOPIFY_ADMIN_PRESET: AccessItemPreset = {
  name: "Shopify Admin",
  defaultRole: "Staff account",
  ownership: "client_invite",
  instructions: inviteInstructions("as a Staff account in Settings → Users and permissions", "an Administrator"),
};
const CLOUDFLARE_PRESET: AccessItemPreset = {
  name: "Cloudflare",
  defaultRole: "Administrator",
  ownership: "client_invite",
  instructions: inviteInstructions("as a member on their Cloudflare account (DNS/CDN) under Manage Account → Members", "an Administrator"),
};
const GA4_PRESET: AccessItemPreset = {
  name: "GA4",
  defaultRole: "Administrator",
  ownership: "self_created",
  instructions: "Property created under your agency Google account — access is already in place. Ownership hands to the client at project handoff.",
};
const GTM_PRESET: AccessItemPreset = {
  name: "Google Tag Manager",
  defaultRole: "Administrator",
  ownership: "self_created",
  instructions: "Container created under your agency Google account — access is already in place. Ownership hands to the client at project handoff.",
};
const GSC_PRESET: AccessItemPreset = {
  name: "Google Search Console",
  defaultRole: "Owner",
  ownership: "self_created",
  instructions: "Verified under your agency Google account — access is already in place. Ownership hands to the client at project handoff.",
};
const CLARITY_PRESET: AccessItemPreset = {
  name: "Microsoft Clarity",
  defaultRole: "Admin",
  ownership: "self_created",
  instructions: "Created under your agency Microsoft account — access is already in place. Ownership hands to the client at project handoff.",
};
const META_BUSINESS_PRESET: AccessItemPreset = {
  name: "Meta Business Manager",
  defaultRole: "Partner (Admin)",
  ownership: "client_invite",
  instructions: inviteInstructions("as a Partner in Business Settings → Partners, with Admin access to the ad account", "a Partner"),
};
const KLAVIYO_PRESET: AccessItemPreset = {
  name: "Klaviyo",
  defaultRole: "Admin",
  ownership: "client_invite",
  instructions: inviteInstructions("as a User under Account → Users", "an Admin/Manager"),
};
const STRIPE_PRESET: AccessItemPreset = {
  name: "Stripe",
  defaultRole: "Administrator",
  ownership: "client_invite",
  instructions: inviteInstructions("as a team member under Settings → Team, with full access", "an Administrator"),
};
const PRINTIFY_PRESET: AccessItemPreset = {
  name: "Printify",
  defaultRole: "Team member",
  ownership: "client_invite",
  instructions: inviteInstructions("as a team member on their Printify account", "a team member"),
};
const GHL_PRESET: AccessItemPreset = {
  name: "GoHighLevel",
  defaultRole: "Admin",
  ownership: "client_invite",
  instructions: inviteInstructions("as a User under Settings → My Staff", "an Admin"),
};
const DOMAIN_REGISTRAR_PRESET: AccessItemPreset = {
  name: "Domain Registrar",
  defaultRole: "Full access",
  ownership: "self_created",
  instructions: "Agency GoDaddy access covers most domains. If this one's registered elsewhere, ask the client for registrar access instead.",
};

/**
 * "wordpress" and "shopify" bundle the full standard stack Paul actually
 * uses on nearly every client site (analytics/tracking + Meta Pixel +
 * Cloudflare) rather than only the items tied 1:1 to that one technology —
 * so picking WordPress or Shopify in the wizard auto-creates the whole
 * access checklist in one shot instead of requiring GA4/GTM/GSC/Clarity/
 * Meta Ads to each be separately selected too. Items not actually needed
 * on a given project can be marked "Not needed" or deleted after the fact.
 */
export const ACCESS_ITEM_PRESETS: Record<string, AccessItemPreset[]> = {
  wordpress: [
    WORDPRESS_ADMIN_PRESET,
    CLOUDWAYS_PRESET,
    CLOUDFLARE_PRESET,
    GA4_PRESET,
    GTM_PRESET,
    GSC_PRESET,
    CLARITY_PRESET,
    META_BUSINESS_PRESET,
  ],
  shopify: [
    SHOPIFY_ADMIN_PRESET,
    CLOUDFLARE_PRESET,
    GA4_PRESET,
    GTM_PRESET,
    GSC_PRESET,
    CLARITY_PRESET,
    META_BUSINESS_PRESET,
    KLAVIYO_PRESET,
    STRIPE_PRESET,
  ],
  elementor: [ELEMENTOR_PRESET],
  figma: [FIGMA_PRESET],
  ga4: [GA4_PRESET],
  gtm: [GTM_PRESET],
  gsc: [GSC_PRESET],
  clarity: [CLARITY_PRESET],
  klaviyo: [KLAVIYO_PRESET],
  printify: [PRINTIFY_PRESET],
  ghl: [GHL_PRESET],
  meta_ads: [META_BUSINESS_PRESET],
};

// Always relevant regardless of tech stack.
export const ALWAYS_INCLUDED_ACCESS_ITEMS: AccessItemPreset[] = [DOMAIN_REGISTRAR_PRESET];

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
