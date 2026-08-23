"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { XIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SHOW_LABELS: Record<string, string> = {
  all: "All Plans",
  ACTIVE: "Active",
  PAUSED: "Paused",
  DUE: "Due Now",
  UNPAID: "Unpaid",
};
const SHOW_KEYS = ["all", "ACTIVE", "PAUSED", "DUE", "UNPAID"];

const SORT_LABELS: Record<string, string> = {
  due: "Next Due",
  client: "Client",
  name: "Plan Name",
  cadence: "Cadence",
  lastGenerated: "Last Generated",
};
const SORT_KEYS = ["due", "client", "name", "cadence", "lastGenerated"];

const GROUP_LABELS: Record<string, string> = {
  none: "None",
  client: "Client",
  project: "Project",
  status: "Status",
  payment: "Payment Status",
};
const GROUP_KEYS = ["none", "client", "project", "status", "payment"];

export function MaintenanceToolbar({
  status,
  statusCounts,
  sort,
  group,
  project,
  projectOptions,
  view,
}: {
  status: string;
  statusCounts: Record<string, number>;
  sort: string;
  group: string;
  project: string;
  projectOptions: string[];
  view: string;
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
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Cards is always grouped by client (that's the whole point of the card
  // view) — Group only applies when actually looking at the flexible List
  // view.
  const groupDisabled = view !== "list";

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
        <Select value={sort || "due"} items={SORT_LABELS} onValueChange={(v) => setParam("sort", v as string)}>
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
        <Select
          value={group || "none"}
          items={GROUP_LABELS}
          disabled={groupDisabled}
          onValueChange={(v) => setParam("group", v as string)}
        >
          <SelectTrigger
            size="sm"
            title={groupDisabled ? "Only the List view can be grouped — Cards has a fixed grouping by client" : undefined}
          >
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
        <Select value={project} onValueChange={(v) => setParam("project", v as string)}>
          <SelectTrigger size="sm">
            <span className="text-muted-foreground">{project ? "Project:" : "+ Add Filter"}</span>
            {project && <SelectValue />}
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="w-max min-w-40">
            {projectOptions.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {project && (
          <button
            type="button"
            onClick={() => setParam("project", null)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground hover:bg-muted"
            aria-label="Clear project filter"
            title="Clear project filter"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
