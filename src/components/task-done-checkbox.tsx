"use client";

import { useState } from "react";
import { queueTaskStatusChange } from "@/lib/task-status-batch";

export function TaskDoneCheckbox({ taskId, status }: { taskId: string; status: string }) {
  const [localStatus, setLocalStatus] = useState(status);

  // Adjusting state during render (React's documented pattern) rather than
  // a useEffect when the server-provided status changes underneath us
  // (e.g. once a batched flush's revalidation lands).
  const [prevStatus, setPrevStatus] = useState(status);
  if (status !== prevStatus) {
    setPrevStatus(status);
    setLocalStatus(status);
  }

  const done = localStatus === "DONE";

  return (
    <input
      type="checkbox"
      checked={done}
      onChange={(e) => {
        const next = e.target.checked ? "DONE" : "TODO";
        // Optimistic and immediate — the actual server write is deferred
        // and batched (see task-status-batch.ts) so checking several boxes
        // quickly doesn't fire a full page-revalidating request per click.
        setLocalStatus(next);
        queueTaskStatusChange(taskId, next);
      }}
      className="h-4 w-4 shrink-0 cursor-pointer rounded border-black/25 accent-[#0ca30c]"
      aria-label={done ? "Mark as not done" : "Mark as done"}
    />
  );
}
