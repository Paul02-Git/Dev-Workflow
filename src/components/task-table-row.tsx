"use client";

import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import { TaskStatusSelect } from "@/components/task-status-select";
import { TaskDoneCheckbox } from "@/components/task-done-checkbox";
import { TaskDetailsToggle } from "@/components/task-details";
import { TaskWaitingToggle } from "@/components/task-waiting-toggle";
import { TaskNotesCell } from "@/components/task-notes-cell";
import { TaskDueDateCell } from "@/components/task-due-date-cell";

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "#d03b3b",
  HIGH: "#c9720a",
};
const PRIORITY_BG: Record<string, string> = {
  CRITICAL: "#fbe6e6",
  HIGH: "#fef4de",
};

export type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  effectiveStatus: string;
  isCritical: boolean;
  priority: string;
  dueDate: Date | string | null;
  assignee: string | null;
  notes: string | null;
  isWaitingOnClient: boolean;
  tags: { id: string; name: string }[];
  attachments: { id: string; url: string | null; storagePath: string | null; label: string | null }[];
};

// Color is reserved for what actually needs attention — Critical/High get
// a pill, Medium/Low (the common case on most projects) render as quiet
// text so the row is not fighting for attention on every priority level.
function PriorityPill({ task }: { task: BoardTask }) {
  const label = task.isCritical ? "CRITICAL" : task.priority;
  const emphasized = label === "CRITICAL" || label === "HIGH";
  const text = label.charAt(0) + label.slice(1).toLowerCase();

  if (!emphasized) return <span className="text-sm text-muted-foreground">{text}</span>;

  return (
    <span
      className="w-fit rounded-full px-2.5 py-1 text-sm font-semibold"
      style={{ backgroundColor: PRIORITY_BG[label], color: PRIORITY_COLOR[label] }}
    >
      {text}
    </span>
  );
}

function SubtaskRow({ task }: { task: BoardTask }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-1.5 ${
        task.effectiveStatus === "DONE" ? "bg-[#eafaea]/50" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <TaskDoneCheckbox taskId={task.id} status={task.status} />
        <span className="truncate text-sm text-muted-foreground">{task.title}</span>
      </div>
      <TaskStatusSelect taskId={task.id} status={task.status} effectiveStatus={task.effectiveStatus} />
    </div>
  );
}

export function TaskTableRow({ task, subtasks }: { task: BoardTask; subtasks: BoardTask[] }) {
  const [open, setOpen] = useState(false);
  const hasSubtasks = subtasks.length > 0;
  const hasDetails = !!task.notes || !!task.dueDate || task.attachments.length > 0;

  return (
    <>
      <tr
        className={`group/row border-b border-border last:border-0 ${
          task.effectiveStatus === "DONE" ? "bg-[#eafaea]/30" : ""
        }`}
      >
        <td className="px-3 py-2.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="pt-0.5">
              <TaskDoneCheckbox taskId={task.id} status={task.status} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-medium text-foreground">{task.title}</span>
                {task.status === "DONE" && task.attachments.length > 0 && (
                  <span
                    className="rounded-full bg-[#eafaea] px-1.5 py-0.5 text-xs font-semibold text-[#0ca30c]"
                    title={`${task.attachments.length} attachment(s) as proof`}
                  >
                    Verified
                  </span>
                )}
                {task.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full bg-[#eef2fb] px-1.5 py-0.5 text-xs font-medium text-[#2a4d8f]"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
              {hasDetails && (
                <TaskDetailsToggle
                  taskId={task.id}
                  notes={task.notes}
                  dueDate={task.dueDate}
                  attachments={task.attachments}
                />
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1">
            <TaskStatusSelect taskId={task.id} status={task.status} effectiveStatus={task.effectiveStatus} />
            {/* Muted and only fully visible on hover/active - a rarely-used
                flag should not compete with the status pill for attention
                on every single row. */}
            <div className={task.isWaitingOnClient ? "" : "opacity-0 transition-opacity group-hover/row:opacity-100"}>
              <TaskWaitingToggle taskId={task.id} isWaitingOnClient={task.isWaitingOnClient} />
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <TaskNotesCell taskId={task.id} notes={task.notes} />
        </td>
        <td className="px-3 py-2.5">
          <TaskDueDateCell taskId={task.id} dueDate={task.dueDate} effectiveStatus={task.effectiveStatus} />
        </td>
        <td className="px-3 py-2.5">
          {hasSubtasks ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-expanded={open}
            >
              <ChevronRightIcon className={`size-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
              {subtasks.length}
            </button>
          ) : (
            <span className="text-sm text-muted-foreground/40">-</span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <PriorityPill task={task} />
        </td>
      </tr>
      {open && hasSubtasks && (
        <tr className="border-b border-border last:border-0">
          <td colSpan={6} className="bg-muted/20 p-0">
            <div className="divide-y divide-border/60 pl-10">
              {subtasks.map((sub) => (
                <SubtaskRow key={sub.id} task={sub} />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
