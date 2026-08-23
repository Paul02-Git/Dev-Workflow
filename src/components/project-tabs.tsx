"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const POLL_INTERVAL_MS = 8000;

type Tab = {
  label: string;
  slug: string;
  badge?: string | number;
  /** One or more REST routes, each returning a JSON array — when set, this
   * tab's badge count stays live (summed across all of them into one
   * number) and a single unread dot appears on the tab while it's inactive
   * and new items have arrived on any of them since it was last viewed. */
  notifyUrl?: string | string[];
  content: ReactNode;
};

function notifyUrls(tab: Tab): string[] {
  if (!tab.notifyUrl) return [];
  return Array.isArray(tab.notifyUrl) ? tab.notifyUrl : [tab.notifyUrl];
}

export function ProjectTabs({ tabs }: { tabs: Tab[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  // Derived from the URL on every render (not local state) — a plain <Link
  // tab=...> to this same route only updates search params, it doesn't
  // remount this component, so a useState initialized once at mount would
  // never pick up a later "View all" / "Project Settings" style deep link.
  const active = Math.max(
    0,
    tabs.findIndex((t) => t.slug === requestedTab)
  );
  const activeSlug = tabs[active]?.slug;

  const notifyTabs = tabs.filter((t) => notifyUrls(t).length > 0);
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(notifyTabs.map((t) => [t.slug, typeof t.badge === "number" ? t.badge : 0]))
  );
  const [seen, setSeen] = useState<Record<string, number>>(() =>
    Object.fromEntries(notifyTabs.map((t) => [t.slug, typeof t.badge === "number" ? t.badge : 0]))
  );

  // A second, independent poll from whatever the tab's own content does
  // internally — deliberately so, matching this app's established pattern
  // (Messages/Files tabs already each poll their own REST route on this
  // same interval). This one only needs a count, so the tab bar itself can
  // show a notification dot even while the tab holding the new item isn't
  // the active/visible one — content-level polling alone can't do that
  // since a hidden tab's own poll updates state nothing on screen reads.
  useEffect(() => {
    if (notifyTabs.length === 0) return;
    let cancelled = false;
    const poll = async () => {
      const results = await Promise.all(
        notifyTabs.map(async (tab) => {
          try {
            const counts = await Promise.all(
              notifyUrls(tab).map(async (url) => {
                const res = await fetch(url, { cache: "no-store" });
                if (!res.ok) return 0;
                const fresh: unknown[] = await res.json();
                return fresh.length;
              })
            );
            return { slug: tab.slug, count: counts.reduce((a, b) => a + b, 0) };
          } catch (err) {
            console.error(`Tab notification poll failed for ${tab.slug}:`, err);
            return null;
          }
        })
      );
      if (cancelled) return;
      setCounts((prev) => {
        const next = { ...prev };
        for (const r of results) if (r) next[r.slug] = r.count;
        return next;
      });
      setSeen((prev) => {
        const next = { ...prev };
        for (const r of results) if (r && r.slug === activeSlug) next[r.slug] = r.count;
        return next;
      });
    };
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notifyTabs is derived fresh from `tabs` every render; the tab set/URLs are static for a given page load, only activeSlug should restart this
  }, [activeSlug]);

  function selectTab(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", slug);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setSeen((prev) => (slug in counts ? { ...prev, [slug]: counts[slug] } : prev));
  }

  return (
    <div>
      <div className="mb-4 border-b border-border">
        <nav className="-mb-px flex gap-1">
          {tabs.map((tab, i) => {
            const isNotifyTab = notifyUrls(tab).length > 0;
            const liveCount = isNotifyTab ? counts[tab.slug] : undefined;
            const displayBadge = liveCount !== undefined ? liveCount || undefined : tab.badge;
            const hasUnread = isNotifyTab && active !== i && (counts[tab.slug] ?? 0) > (seen[tab.slug] ?? 0);
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => selectTab(tab.slug)}
                className={`relative flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  active === i
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {displayBadge !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                      active === i ? "bg-[#eef2fb] text-primary" : "bg-black/5 text-muted-foreground"
                    }`}
                  >
                    {displayBadge}
                  </span>
                )}
                {hasUnread && (
                  <span aria-label="New activity" className="absolute right-0.5 top-1.5 size-2 rounded-full bg-[#d03b3b]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
      {tabs.map((tab, i) => (
        <div key={tab.label} className={active === i ? "" : "hidden"}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
