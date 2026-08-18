"use client";

import { type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ProjectTabs({
  tabs,
}: {
  tabs: { label: string; slug: string; badge?: string | number; content: ReactNode }[];
}) {
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

  function selectTab(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", slug);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div>
      <div className="mb-4 border-b border-border">
        <nav className="-mb-px flex gap-1">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => selectTab(tab.slug)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active === i
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active === i ? "bg-[#eef2fb] text-primary" : "bg-black/5 text-muted-foreground"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
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
