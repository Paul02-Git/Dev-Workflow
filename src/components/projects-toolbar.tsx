"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { XIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SHOW_LABELS: Record<string, string> = {
  all: "All Projects",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  LAUNCHED: "Launched",
  ARCHIVED: "Archived",
};
const SHOW_KEYS = ["all", "ACTIVE", "ON_HOLD", "LAUNCHED", "ARCHIVED"];

const SORT_LABELS: Record<string, string> = {
  created: "Date Created",
  deadline: "Deadline",
  health: "Health Score",
  priority: "Priority",
  name: "Name (A–Z)",
};
const SORT_KEYS = ["created", "deadline", "health", "priority", "name"];

const GROUP_LABELS: Record<string, string> = {
  none: "None",
  status: "Status",
  client: "Client",
};
const GROUP_KEYS = ["none", "status", "client"];

export function ProjectsToolbar({
  status,
  statusCounts,
  sort,
  group,
  tech,
  technologyOptions,
}: {
  status: string;
  statusCounts: Record<string, number>;
  sort: string;
  group: string;
  tech: string;
  technologyOptions: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "" || value === "all" || value === "none") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // Any filter/sort/group change invalidates the current page's meaning.
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>Show:</span>
        <Select value={status || "all"} items={SHOW_LABELS} onValueChange={(v) => setParam("status", v as string)}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="w-max min-w-40">
            {SHOW_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {SHOW_LABELS[k]}
                <span className="text-muted-foreground">({statusCounts[k] ?? 0})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>Sort:</span>
        <Select value={sort || "created"} items={SORT_LABELS} onValueChange={(v) => setParam("sort", v as string)}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="w-max min-w-40">
            {SORT_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {SORT_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span>Group:</span>
        <Select value={group || "none"} items={GROUP_LABELS} onValueChange={(v) => setParam("group", v as string)}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="w-max min-w-40">
            {GROUP_KEYS.map((k) => (
              <SelectItem key={k} value={k}>
                {GROUP_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1.5">
        <Select value={tech} onValueChange={(v) => setParam("tech", v as string)}>
          <SelectTrigger size="sm">
            <span className="text-muted-foreground">{tech ? "Technology:" : "+ Add Filter"}</span>
            {tech && <SelectValue />}
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="w-max min-w-40">
            {technologyOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tech && (
          <button
            type="button"
            onClick={() => setParam("tech", null)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground hover:bg-muted"
            aria-label="Clear technology filter"
            title="Clear technology filter"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
