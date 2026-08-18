import {
  SiWordpress,
  SiShopify,
  SiGoogleanalytics,
  SiGooglesearchconsole,
  SiGoogletagmanager,
  SiMeta,
  SiFacebook,
  SiCloudways,
  SiElementor,
} from "react-icons/si";
import { GlobeIcon } from "lucide-react";
import type { IconType } from "react-icons";
import { hashPick } from "@/lib/hash-color";

/**
 * One config per platform: real brand icon (where Simple Icons has one)
 * plus a generic login URL to fall back to on "Open" when this specific
 * access item has no per-project URL saved yet. Only platforms with a
 * genuinely universal login page get one — WordPress/Elementor are
 * self-hosted per site (no single URL could ever be right) and are
 * deliberately left without a login fallback.
 */
const PLATFORM_META: { match: RegExp; Icon?: IconType; color: string; loginUrl?: string }[] = [
  { match: /domain|registrar/i, Icon: GlobeIcon as IconType, color: "#52514e", loginUrl: "https://sso.godaddy.com/" },
  { match: /wordpress|wp\b/i, Icon: SiWordpress, color: "#21759B" },
  { match: /elementor/i, Icon: SiElementor, color: "#92003B" },
  { match: /shopify/i, Icon: SiShopify, color: "#95BF47", loginUrl: "https://accounts.shopify.com/store-login" },
  {
    match: /google analytics|ga4/i,
    Icon: SiGoogleanalytics,
    color: "#E37400",
    loginUrl: "https://analytics.google.com/",
  },
  {
    match: /search console|gsc/i,
    Icon: SiGooglesearchconsole,
    color: "#458CF5",
    loginUrl: "https://search.google.com/search-console",
  },
  {
    match: /tag manager|gtm/i,
    Icon: SiGoogletagmanager,
    color: "#246FDB",
    loginUrl: "https://tagmanager.google.com/",
  },
  { match: /facebook/i, Icon: SiFacebook, color: "#1877F2", loginUrl: "https://business.facebook.com/" },
  { match: /meta business|meta\b/i, Icon: SiMeta, color: "#0468D7", loginUrl: "https://business.facebook.com/" },
  { match: /cloudways/i, Icon: SiCloudways, color: "#2C39BD", loginUrl: "https://platform.cloudways.com/login" },
  { match: /clarity/i, color: "#a259ff", loginUrl: "https://clarity.microsoft.com/" },
  { match: /klaviyo/i, color: "#0b0b0b", loginUrl: "https://www.klaviyo.com/login" },
  { match: /printify/i, color: "#a259ff", loginUrl: "https://printify.com/app/login/" },
  { match: /gohighlevel|ghl\b/i, color: "#0ca30c", loginUrl: "https://app.gohighlevel.com/" },
];

export function resolvePlatformIcon(name: string): { Icon: IconType; color: string } | null {
  for (const entry of PLATFORM_META) {
    if (entry.Icon && entry.match.test(name)) return { Icon: entry.Icon, color: entry.color };
  }
  return null;
}

/** Generic login URL for a platform, used when this access item has no per-project URL of its own yet. */
export function resolvePlatformLoginUrl(name: string): string | null {
  for (const entry of PLATFORM_META) {
    if (entry.loginUrl && entry.match.test(name)) return entry.loginUrl;
  }
  return null;
}

export function PlatformIcon({ name, size = 28 }: { name: string; size?: number }) {
  const resolved = resolvePlatformIcon(name);
  if (!resolved) return null;
  const { Icon, color } = resolved;
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-black/10"
      style={{ width: size, height: size }}
    >
      <Icon size={size * 0.55} color={color} />
    </span>
  );
}

// Colored monogram fallback for platforms with no real brand icon in
// Simple Icons (Klaviyo, Printify, GoHighLevel, Microsoft Clarity) or any
// custom free-text name — same hash-based palette used elsewhere in the
// app for this exact fallback, kept here as the one shared version.
const MONOGRAM_PALETTE = ["#2a78d6", "#0ca30c", "#c9720a", "#a259ff", "#d03b3b", "#0b8f8f"];
function monogramColor(name: string): string {
  return hashPick(name, MONOGRAM_PALETTE);
}

/** Always renders something — the real brand icon when one resolves, otherwise a colored monogram. */
export function PlatformBadge({ name, size = 28 }: { name: string; size?: number }) {
  if (resolvePlatformIcon(name)) return <PlatformIcon name={name} size={size} />;
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, backgroundColor: monogramColor(name), fontSize: size * 0.4 }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
