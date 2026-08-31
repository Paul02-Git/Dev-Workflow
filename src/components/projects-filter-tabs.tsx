import Link from "next/link";
import { ListChecksIcon, StarIcon, ActivityIcon, PauseIcon, RocketIcon, ArchiveIcon, type LucideIcon } from "lucide-react";

const TABS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "all", label: "All", icon: ListChecksIcon },
  { key: "PINNED", label: "Pinned", icon: StarIcon },
  { key: "ACTIVE", label: "Active", icon: ActivityIcon },
  { key: "ON_HOLD", label: "Paused", icon: PauseIcon },
  { key: "LAUNCHED", label: "Launched", icon: RocketIcon },
  { key: "ARCHIVED", label: "Archived", icon: ArchiveIcon },
];

/** Preserves every other query param when switching tabs — only `status` (and the now-irrelevant `page`) changes. */
function hrefFor(key: string, currentParams: URLSearchParams): string {
  const params = new URLSearchParams(currentParams.toString());
  if (key === "all") params.delete("status");
  else params.set("status", key);
  params.delete("page");
  const qs = params.toString();
  return qs ? `/projects?${qs}` : "/projects";
}

export function ProjectsFilterTabs({
  active,
  counts,
  searchParamsString,
  right,
}: {
  active: string;
  counts: Record<string, number>;
  searchParamsString: string;
  /** Rendered flush right on the same bordered row — e.g. the search box and sort/group/filter toolbar. */
  right?: React.ReactNode;
}) {
  const currentParams = new URLSearchParams(searchParamsString);

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-b border-border py-2">
      <div className="flex flex-wrap items-center gap-1">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={hrefFor(tab.key, currentParams)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                  isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {counts[tab.key] ?? 0}
              </span>
            </Link>
          );
        })}
      </div>
      {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}
