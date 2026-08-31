"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateTaskStatusAction } from "@/lib/actions";

const STATUS_LABELS: Record<string, string> = {
  TODO: "Todo",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  REVIEW: "Review",
  DONE: "Done",
  SKIPPED: "Skipped",
};

export const STATUS_COLORS: Record<string, string> = {
  TODO: "#52514e",
  IN_PROGRESS: "#2a78d6",
  BLOCKED: "#d03b3b",
  REVIEW: "#8a5c00",
  DONE: "#0ca30c",
  SKIPPED: "#52514e",
};

const STATUS_BG: Record<string, string> = {
  TODO: "#f1f0ee",
  IN_PROGRESS: "#eef2fb",
  BLOCKED: "#fbe6e6",
  REVIEW: "#fef4de",
  DONE: "#eafaea",
  SKIPPED: "#f1f0ee",
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
    <div className="flex items-center gap-1.5">
      <Select
        value={status}
        items={STATUS_LABELS}
        disabled={pending}
        onValueChange={(value) => startTransition(() => updateTaskStatusAction(taskId, value as string))}
      >
        <SelectTrigger
          className="h-8 w-[120px] shrink-0 justify-between rounded-lg border-0 pr-2 pl-2.5 text-sm font-medium"
          style={{ backgroundColor: STATUS_BG[status], color: STATUS_COLORS[status] }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isAutoBlocked && (
        <span
          className="size-1.5 shrink-0 rounded-full bg-[#d03b3b]"
          title="Blocked by an unfinished dependency"
        />
      )}
    </div>
  );
}
