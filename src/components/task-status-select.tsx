"use client";

import { useTransition } from "react";
import { updateTaskStatusAction } from "@/lib/actions";

const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "DONE", "SKIPPED"];

export const STATUS_COLORS: Record<string, string> = {
  TODO: "#898781",
  IN_PROGRESS: "#2a78d6",
  BLOCKED: "#d03b3b",
  REVIEW: "#eda100",
  DONE: "#0ca30c",
  SKIPPED: "#898781",
};

export function TaskStatusSelect({
  taskId,
  status,
  effectiveStatus,
}: {
  taskId: string;
  status: string;
  effectiveStatus: string;
}) {
  const [pending, startTransition] = useTransition();
  const isAutoBlocked = effectiveStatus === "BLOCKED" && status !== "BLOCKED";

  return (
    <div className="flex items-center gap-2">
      {isAutoBlocked && (
        <span className="rounded-full bg-[#fbe6e6] px-2 py-0.5 text-xs font-semibold text-[#d03b3b]">
          Blocked by dependency
        </span>
      )}
      <select
        value={status}
        disabled={pending}
        onChange={(e) => startTransition(() => updateTaskStatusAction(taskId, e.target.value))}
        style={{ color: STATUS_COLORS[status] }}
        className="rounded-md border border-black/15 bg-white px-2 py-1 text-xs font-semibold"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
    </div>
  );
}
