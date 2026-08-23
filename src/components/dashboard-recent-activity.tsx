import Link from "next/link";
import { ActivityIcon } from "lucide-react";
import { formatActivitySentence, relativeTime, type ActivityRow } from "@/lib/format-activity";
import { SquarePlatformIcon } from "@/components/platform-icon";

type ProjectActivityRow = ActivityRow & { projectId: string; projectName: string; primaryTech: string | null };

function dayLabel(date: Date): string {
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Cross-project activity, grouped into compact day columns (Today /
 * Yesterday / Aug 15 / ...) rather than the vertical day-bucketed list the
 * per-project Activity tab uses — this is a dashboard glance, not a full log.
 * No "View full log" link — there's no cross-project log page to send it
 * to; each item below links to its own project's real log instead.
 */
export function DashboardRecentActivity({ activity }: { activity: ProjectActivityRow[] }) {
  const groups = new Map<string, { label: string; items: ProjectActivityRow[] }>();
  for (const row of activity) {
    const d = new Date(row.createdAt);
    const key = dayKey(d);
    if (!groups.has(key)) groups.set(key, { label: dayLabel(d), items: [] });
    groups.get(key)!.items.push(row);
  }
  const dayGroups = Array.from(groups.values()).slice(0, 4);
  // Tasks actually finished today, not a raw event count — "16 today" or
  // "3 projects today" both just describe how much log noise exists, not
  // whether anything got done. Real completions is the one number worth
  // seeing before you even scroll the feed below it.
  const todayItems = groups.get(dayKey(new Date()))?.items ?? [];
  const doneTodayCount = todayItems.filter(
    (row) => row.action === "task_status_changed" && row.detail === "DONE"
  ).length;

  return (
    <div className="app-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f2effc] text-[#7c5cf0]">
            <ActivityIcon className="size-5" />
          </span>
          <h2 className="text-base font-semibold">Recent Activity</h2>
        </div>
        {activity.length > 0 && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
              doneTodayCount > 0 ? "bg-[#eafaea] text-[#0ca30c]" : "bg-black/5 text-muted-foreground"
            }`}
          >
            {doneTodayCount > 0 ? `${doneTodayCount} done today` : "Nothing done today"}
          </span>
        )}
      </div>
      {dayGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {dayGroups.map((g) => (
            <div key={g.label} className="min-w-0">
              <div className="mb-2 text-xs font-medium text-muted-foreground">{g.label}</div>
              <ul className="space-y-2">
                {g.items.slice(0, 4).map((row) => {
                  const { rest } = formatActivitySentence(row);
                  return (
                    <li key={row.id}>
                      <Link
                        href={`/projects/${row.projectId}?tab=activity`}
                        className="flex items-center gap-2 rounded-lg p-2 text-xs hover:bg-muted"
                        title={`View ${row.projectName}'s activity log`}
                      >
                        {row.primaryTech ? (
                          <SquarePlatformIcon name={row.primaryTech} size={20} />
                        ) : (
                          <span className="h-5 w-5 shrink-0 rounded-[4px] bg-black/5" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-foreground">{row.projectName}</span>
                          <span className="block truncate text-muted-foreground">
                            {rest.charAt(0).toUpperCase() + rest.slice(1)}
                          </span>
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-muted-foreground">{relativeTime(row.createdAt)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
