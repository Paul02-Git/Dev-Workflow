import { formatActivitySentence, relativeTime, activityDateBucket, type ActivityRow } from "@/lib/format-activity";
import { ActorAvatar } from "@/components/actor-avatar";

const BUCKET_ORDER = ["Today", "Yesterday", "This week", "Earlier"];

export function ActivityTab({ activity }: { activity: ActivityRow[] }) {
  if (activity.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        No activity recorded yet.
      </div>
    );
  }

  const byBucket = new Map<string, ActivityRow[]>();
  for (const row of activity) {
    const bucket = activityDateBucket(row.createdAt);
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket)!.push(row);
  }

  return (
    <div className="space-y-5">
      {BUCKET_ORDER.filter((b) => byBucket.has(b)).map((bucket) => (
        <div key={bucket}>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{bucket}</h3>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {byBucket.get(bucket)!.map((row) => {
              const { actor, rest } = formatActivitySentence(row);
              return (
                <div key={row.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                  <ActorAvatar name={actor} size={24} />
                  <span className="min-w-0 flex-1 text-[#52514e]">
                    <span className="font-semibold text-foreground">{actor}</span> {rest}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(row.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
