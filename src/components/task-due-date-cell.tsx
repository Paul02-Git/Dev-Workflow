"use client";

import { useTransition } from "react";
import { updateTaskDetailsAction } from "@/lib/actions";
import { toDateInputValue } from "@/components/task-details";

/** Same real `<input type="date">` the task details modal uses to edit due date - right on the row, no modal needed. */
export function TaskDueDateCell({
  taskId,
  dueDate,
  effectiveStatus,
}: {
  taskId: string;
  dueDate: Date | string | null;
  effectiveStatus: string;
}) {
  const [, startTransition] = useTransition();
  const overdue = !!dueDate && new Date(dueDate) < new Date() && effectiveStatus !== "DONE";

  return (
    <input
      type="date"
      defaultValue={toDateInputValue(dueDate)}
      onChange={(e) => startTransition(() => updateTaskDetailsAction(taskId, { dueDate: e.target.value }))}
      className={`w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-input hover:bg-card focus:border-input focus:bg-card focus:outline-none ${
        overdue ? "font-medium text-[#d03b3b]" : dueDate ? "text-muted-foreground" : "text-muted-foreground/40"
      }`}
    />
  );
}
