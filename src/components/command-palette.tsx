"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchAction } from "@/lib/actions";
import type { SearchResult } from "@/lib/queries/search";

type Item = SearchResult | { type: "nav"; id: string; title: string; subtitle: string; href: string };

const NAV_ITEMS: Item[] = [
  { type: "nav", id: "dashboard", title: "Dashboard", subtitle: "Go to", href: "/dashboard" },
  { type: "nav", id: "projects", title: "Projects", subtitle: "Go to", href: "/projects" },
  { type: "nav", id: "new-project", title: "New project", subtitle: "Go to", href: "/projects/new" },
  { type: "nav", id: "tasks", title: "Tasks", subtitle: "Go to", href: "/tasks" },
  { type: "nav", id: "today", title: "Today", subtitle: "Go to", href: "/today" },
  { type: "nav", id: "clients", title: "Clients", subtitle: "Go to", href: "/clients" },
  { type: "nav", id: "maintenance", title: "Maintenance", subtitle: "Go to", href: "/maintenance" },
  { type: "nav", id: "templates", title: "Workflow Templates", subtitle: "Go to", href: "/templates" },
  { type: "nav", id: "qa", title: "QA", subtitle: "Go to", href: "/qa" },
  { type: "nav", id: "reports", title: "Reports", subtitle: "Go to", href: "/reports" },
  { type: "nav", id: "integrations", title: "Integrations", subtitle: "Go to", href: "/integrations" },
  { type: "nav", id: "settings", title: "Settings", subtitle: "Go to", href: "/settings" },
];

const TYPE_ICON: Record<string, string> = {
  client: "\u{1F464}",
  project: "\u{1F4C1}",
  task: "☑",
  nav: "→",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const items: Item[] = query.trim()
    ? results
    : NAV_ITEMS.filter((n) => n.title.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    function onExternalOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("command-palette:open", onExternalOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("command-palette:open", onExternalOpen);
    };
  }, [open]);

  // Reset the palette's contents at the moment it opens. Done during render
  // (not in an effect) via the "adjust state when a value changes" pattern —
  // https://react.dev/learn/you-might-not-need-an-effect — so it can't cause
  // an extra flash of stale content before the reset commits.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
    }
  }

  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  // Focusing the input is a real side effect (imperative DOM API), so it
  // stays in an effect — it just doesn't set any state itself.
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Debounced live search — setResults happens inside the timeout callback,
  // never synchronously during the effect's own execution.
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const r = await searchAction(query.trim());
        setResults(r);
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [query, startTransition]);

  function go(item: Item) {
    setOpen(false);
    router.push(item.href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (items[activeIndex]) go(items[activeIndex]);
            }
          }}
          placeholder="Search or jump to… (clients, projects, tasks, pages)"
          className="w-full border-b border-border px-4 py-3 text-sm outline-none"
        />
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {query.trim() ? "No matches." : "Start typing to search everything."}
            </div>
          )}
          {items.map((item, i) => (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              onClick={() => go(item)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm ${
                i === activeIndex ? "bg-[#eef2fb]" : ""
              }`}
            >
              <span className="w-4 shrink-0 text-center">{TYPE_ICON[item.type] ?? ""}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>↑↓ navigate · ↵ open · esc close</span>
          <span>Ctrl/⌘K or / to reopen</span>
        </div>
      </div>
    </div>
  );
}
