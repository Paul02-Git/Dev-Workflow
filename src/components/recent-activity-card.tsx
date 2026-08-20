import Link from "next/link";
import { formatActivitySentence, relativeTime, type ActivityRow } from "@/lib/format-activity";
import { ActorAvatar } from "@/components/actor-avatar";

export function RecentActivityCard({ projectId, activity }: { projectId: string; activity: ActivityRow[] }) {
  if (activity.length === 0) return null;

  return (
    <div className="app-card h-full p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Recent activity</h2>
        <Link
          href={`/projects/${projectId}?tab=activity`}
          className="shrink-0 rounded-md border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-primary hover:bg-muted"
        >
          View all
        </Link>
      </div>
      <ul className="divide-y divide-border">
        {activity.map((row) => {
          const { actor, rest } = formatActivitySentence(row);
          return (
            <li key={row.id} className="flex items-start gap-2.5 py-2 text-xs">
              <ActorAvatar name={actor} size={22} />
              <span className="min-w-0 flex-1 text-[#52514e]">
                <span className="font-semibold text-foreground">{actor}</span> {rest}
              </span>
              <span className="shrink-0 text-muted-foreground">{relativeTime(row.createdAt)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
