import Link from "next/link";
import { ClockIcon } from "lucide-react";

type WaitingTask = {
  id: string;
  title: string;
  waitingOnClientSince: Date | string | null;
  tabSlug: "tasks" | "qa";
};

const PREVIEW_LIMIT = 3;

function daysWaiting(since: Date | string): number {
  const ms = Date.now() - new Date(since).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

/** This project's own tasks flagged "waiting on client" — oldest first, unlike the dashboard's cross-project version which dedupes to one row per project. */
export function WaitingOnClientCard({ projectId, tasks }: { projectId: string; tasks: WaitingTask[] }) {
  const preview = tasks.slice(0, PREVIEW_LIMIT);
  const remaining = tasks.length - preview.length;
  // "View all" defaults to the Tasks tab, but only if that tab actually
  // has at least one matching item — otherwise (all waiting tasks are
  // QA-stage) it would land on a filtered view that's structurally empty,
  // since QA tasks never render under the Tasks tab.
  const viewAllTabSlug = tasks.some((t) => t.tabSlug === "tasks") ? "tasks" : "qa";

  return (
    <div className="app-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fef4de] text-[#c9720a]">
            <ClockIcon className="size-5" />
          </span>
          <h2 className="text-base font-semibold">Waiting On Client</h2>
        </div>
        {tasks.length > 0 && (
          <Link
            href={`/projects/${projectId}?tab=${viewAllTabSlug}&filter=waiting`}
            className="shrink-0 rounded-md border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-primary hover:bg-muted"
          >
            View all
          </Link>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing waiting on the client right now.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {preview.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/projects/${projectId}?tab=${task.tabSlug}&filter=waiting`}
                  className="flex items-center gap-2.5 rounded-lg border border-[#f5e3b3] bg-[#fef4de] p-3 text-xs hover:bg-[#fdeac3]"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fdeac3] text-[#8a5c00]">
                    <ClockIcon className="size-3.5" />
                  </span>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate font-semibold text-[#8a5c00]">{task.title}</span>
                    {task.waitingOnClientSince && (
                      <span className="shrink-0 font-semibold text-[#8a5c00]">
                        {daysWaiting(task.waitingOnClientSince)}d
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {remaining > 0 && <p className="mt-2 text-xs text-muted-foreground">+{remaining} more</p>}
        </>
      )}
    </div>
  );
}
