import Link from "next/link";
import { UsersIcon, SparklesIcon, ActivityIcon, CheckCircle2Icon, type LucideIcon } from "lucide-react";

export type ClientsTabKey = "all" | "new" | "active" | "completed";

const TABS: { key: ClientsTabKey; label: string; icon: LucideIcon }[] = [
  { key: "all", label: "All Clients", icon: UsersIcon },
  { key: "new", label: "New", icon: SparklesIcon },
  { key: "active", label: "Actively Working", icon: ActivityIcon },
  { key: "completed", label: "Completed", icon: CheckCircle2Icon },
];

function hrefFor(key: ClientsTabKey): string {
  return key === "all" ? "/clients" : `/clients?filter=${key}`;
}

export function ClientsFilterTabs({
  active,
  counts,
  right,
}: {
  active: ClientsTabKey;
  counts: Record<ClientsTabKey, number>;
  /** Rendered flush right on the same bordered row — e.g. the search box. */
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-b border-border py-2">
      <div className="flex flex-wrap items-center gap-1">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={hrefFor(tab.key)}
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
