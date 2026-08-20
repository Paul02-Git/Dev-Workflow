import Link from "next/link";
import { ClockIcon } from "lucide-react";
import type { WaitingOnClientProjectSummary } from "@/lib/queries/projects";

function daysWaiting(since: Date | string): number {
  const ms = Date.now() - new Date(since).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export function DashboardWaitingOnClient({ items }: { items: WaitingOnClientProjectSummary[] }) {
  return (
    <div className="app-card flex h-full flex-col p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fef4de] text-[#c9720a]">
            <ClockIcon className="size-5" />
          </span>
          <h2 className="text-base font-semibold">Waiting On Client</h2>
        </div>
        {items.length > 0 && (
          <Link
            href="/tasks"
            className="shrink-0 rounded-md border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-primary hover:bg-muted"
          >
            View all
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing waiting on a client right now.</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {items.map((item) => (
            <li key={item.projectId}>
              <Link
                href={`/projects/${item.projectId}?tab=${item.tabSlug}&filter=waiting`}
                className="flex items-start gap-2.5 rounded-lg border border-[#f5e3b3] bg-[#fef4de] p-3 text-xs hover:bg-[#fdeac3]"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fdeac3] text-[#8a5c00]">
                  <ClockIcon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-[#8a5c00]">{item.projectName}</span>
                    {item.waitingOnClientSince && (
                      <span className="shrink-0 font-bold text-[#8a5c00]">{daysWaiting(item.waitingOnClientSince)}d</span>
                    )}
                  </div>
                  <div className="truncate text-[#8a5c00]/80">• {item.taskTitle}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
