import Link from "next/link";
import { ListChecksIcon, ClockIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import type { ActionQueueItem } from "@/lib/queries/projects";

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "#d03b3b",
  HIGH: "#d03b3b",
  MEDIUM: "#c9720a",
  LOW: "#0ca30c",
};
const PRIORITY_BG: Record<string, string> = {
  CRITICAL: "#fbe6e6",
  HIGH: "#fbe6e6",
  MEDIUM: "#fef4de",
  LOW: "#eafaea",
};
const PRIORITY_LABEL: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

function estimateLabel(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return [hours > 0 ? `${hours}h` : null, minutes > 0 ? `${minutes}m` : null].filter(Boolean).join(" ") || "0m";
}

export function DashboardActionQueue({ items, previewLimit = 6 }: { items: ActionQueueItem[]; previewLimit?: number }) {
  const shown = items.slice(0, previewLimit);
  const totalMinutes = items.reduce((sum, a) => sum + a.estimateMinutes, 0);

  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#eef2fb] text-[#2a4d8f]">
            <ListChecksIcon className="size-5" />
          </span>
          <CardTitle>My Action Queue</CardTitle>
        </div>
        <CardAction>
          <Link
            href="/tasks"
            className="shrink-0 rounded-md border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-primary hover:bg-muted"
          >
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing actionable right now — every active project is either done or blocked.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {shown.map((item) => {
              const label = item.isCritical ? "CRITICAL" : item.priority;
              return (
                <li key={item.taskId}>
                  <Link
                    href={`/projects/${item.projectId}?tab=${item.tabSlug}${item.isCritical ? "&filter=critical" : ""}`}
                    className="flex items-center gap-3 px-2 py-3 text-sm hover:bg-muted"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full border-2"
                      style={{ borderColor: PRIORITY_COLOR[label] ?? "#898781" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{item.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{item.projectName}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-bold"
                        style={{ backgroundColor: PRIORITY_BG[label] ?? "#f1f0ee", color: PRIORITY_COLOR[label] ?? "#898781" }}
                      >
                        {PRIORITY_LABEL[label] ?? label}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">{item.estimateMinutes}m</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {items.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-xs text-muted-foreground">
            <ClockIcon className="size-3.5" />
            Estimated Time: {estimateLabel(totalMinutes)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
