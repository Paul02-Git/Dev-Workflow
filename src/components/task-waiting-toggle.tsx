"use client";

import { useState, useTransition } from "react";
import { ClockIcon } from "lucide-react";
import { setTaskWaitingOnClientAction } from "@/lib/actions";

/** One-click "waiting on client" flag, sitting directly on the task row next to the status dropdown — no more digging into the details panel just to flag it. */
export function TaskWaitingToggle({ taskId, isWaitingOnClient }: { taskId: string; isWaitingOnClient: boolean }) {
  const [, startTransition] = useTransition();
  const [waiting, setWaiting] = useState(isWaitingOnClient);

  return (
    <button
      type="button"
      onClick={() => {
        const next = !waiting;
        setWaiting(next);
        startTransition(() => setTaskWaitingOnClientAction(taskId, next));
      }}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors ${
        waiting
          ? "border-[#f5e3b3] bg-[#fef4de] text-[#8a5c00]"
          : "border-black/15 text-muted-foreground hover:bg-muted"
      }`}
      title={waiting ? "Waiting on client — click to clear" : "Mark waiting on client"}
      aria-label={waiting ? "Waiting on client — click to clear" : "Mark waiting on client"}
      aria-pressed={waiting}
    >
      <ClockIcon className="size-3.5" />
    </button>
  );
}
