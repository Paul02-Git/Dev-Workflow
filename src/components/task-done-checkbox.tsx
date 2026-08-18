"use client";

import { useTransition } from "react";
import { updateTaskStatusAction } from "@/lib/actions";

export function TaskDoneCheckbox({ taskId, status }: { taskId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const done = status === "DONE";

  return (
    <input
      type="checkbox"
      checked={done}
      disabled={pending}
      onChange={(e) =>
        startTransition(() => updateTaskStatusAction(taskId, e.target.checked ? "DONE" : "TODO"))
      }
      className="h-4 w-4 shrink-0 cursor-pointer rounded border-black/25 accent-[#0ca30c] disabled:opacity-50"
      aria-label={done ? "Mark as not done" : "Mark as done"}
    />
  );
}
