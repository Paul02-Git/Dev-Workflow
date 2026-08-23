"use client";

import { useState, useTransition } from "react";
import { formatActivitySentence, relativeTime, activityDateBucket, type ActivityRow } from "@/lib/format-activity";
import { ActorAvatar } from "@/components/actor-avatar";
import { deleteAllProjectActivityAction } from "@/lib/actions";

const BUCKET_ORDER = ["Today", "Yesterday", "This week", "Earlier"];

export function ActivityTab({ projectId, activity }: { projectId: string; activity: ActivityRow[] }) {
  const [liveActivity, setLiveActivity] = useState(activity);
  const [pending, startTransition] = useTransition();

  // Adjusting state during render (React's documented pattern) rather than
  // a useEffect when the initial `activity` prop changes.
  const [prevActivity, setPrevActivity] = useState(activity);
  if (activity !== prevActivity) {
    setPrevActivity(activity);
    setLiveActivity(activity);
  }

  function handleClearAll() {
    if (!confirm("Delete this project's entire activity history? This can't be undone.")) return;
    setLiveActivity([]);
    startTransition(async () => {
      await deleteAllProjectActivityAction(projectId);
    });
  }

  if (liveActivity.length === 0) {
    return (
      <div className="app-card p-4 text-sm text-muted-foreground">
        No activity recorded yet.
      </div>
    );
  }

  const byBucket = new Map<string, ActivityRow[]>();
  for (const row of liveActivity) {
    const bucket = activityDateBucket(row.createdAt);
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket)!.push(row);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={handleClearAll}
          className="text-xs font-medium text-muted-foreground hover:text-[#d03b3b] disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Delete all"}
        </button>
      </div>
      {BUCKET_ORDER.filter((b) => byBucket.has(b)).map((bucket) => (
        <div key={bucket}>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{bucket}</h3>
          <div className="app-card divide-y divide-border">
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
