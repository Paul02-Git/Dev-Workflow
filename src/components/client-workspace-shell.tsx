"use client";

import { type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Sidebar shell for the public Client Workspace (/portal/[token]) — same
 * "derive the active tab from the URL on every render, never local state"
 * pattern as the internal ProjectTabs component (a plain useState here hit
 * the exact same "View all link doesn't switch tabs" bug documented for
 * that component, since a same-route Link only updates search params
 * without remounting). Visually mirrors the internal dashboard's own
 * sidebar (logo block, stacked nav) rather than ProjectTabs' horizontal
 * tab bar — this page is the client's whole "app", not one tab region
 * inside a bigger page, so it gets the bigger chrome.
 */
export function ClientWorkspaceShell({
  tabs,
}: {
  tabs: { label: string; slug: string; badge?: string | number; content: ReactNode }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const active = Math.max(
    0,
    tabs.findIndex((t) => t.slug === requestedTab)
  );

  function selectTab(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", slug);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card p-4">
        <div className="mb-4 border-b border-border pb-3">
          <div className="text-sm font-semibold leading-tight">
            DEV<span className="text-primary">OS</span>
          </div>
          <div className="text-xs text-muted-foreground">Client workspace</div>
        </div>
        <nav className="space-y-1">
          {tabs.map((tab, i) => (
            <button
              key={tab.slug}
              type="button"
              onClick={() => selectTab(tab.slug)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                active === i
                  ? "bg-[#eef2fb] text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                    active === i ? "bg-primary text-primary-foreground" : "bg-black/10 text-muted-foreground"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <p className="mt-auto pt-3 text-[11px] text-muted-foreground">
          This link is private to you — only people who have it can view or add to it.
        </p>
      </aside>
      <main className="min-w-0 flex-1 p-8">
        {tabs.map((tab, i) => (
          <div key={tab.slug} className={active === i ? "" : "hidden"}>
            {tab.content}
          </div>
        ))}
      </main>
    </div>
  );
}
