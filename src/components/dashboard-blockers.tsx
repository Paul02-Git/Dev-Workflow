import Link from "next/link";
import { AlertCircleIcon, ClockIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import type { BlockedProjectSummary } from "@/lib/queries/projects";

export function DashboardBlockers({ items, previewLimit = 3 }: { items: BlockedProjectSummary[]; previewLimit?: number }) {
  const shown = items.slice(0, previewLimit);

  return (
    <Card size="sm" className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fbe6e6] text-[#d03b3b]">
            <AlertCircleIcon className="size-5" />
          </span>
          <CardTitle>Blockers</CardTitle>
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
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing blocked right now.</p>
        ) : (
          <>
            <div className="mb-3 text-xs font-bold text-[#d03b3b]">
              {items.length} Project{items.length === 1 ? "" : "s"} Blocked
            </div>
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {shown.map((item) => (
                <li key={item.projectId}>
                  <Link
                    href={`/projects/${item.projectId}?tab=${item.tabSlug}&filter=blocked`}
                    className="flex items-center gap-2.5 rounded-lg border border-[#f5cfcf] bg-[#fdf0f0] p-3 text-xs hover:bg-[#fbe6e6]"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fbe6e6] text-[#d03b3b]">
                      <ClockIcon className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{item.projectName}</div>
                      <div className="truncate text-muted-foreground">• {item.taskTitle}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
