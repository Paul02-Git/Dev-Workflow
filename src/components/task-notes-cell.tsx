"use client";

import { useState, useTransition } from "react";
import { updateTaskDetailsAction } from "@/lib/actions";

/** Click-to-edit notes, right on the task row - same idea as the assignee cell it replaced, just multi-line. */
export function TaskNotesCell({ taskId, notes }: { taskId: string; notes: string | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(notes ?? "");
  const [, startTransition] = useTransition();

  function commit() {
    setEditing(false);
    const next = value.trim();
    if (next !== (notes ?? "")) {
      startTransition(() => updateTaskDetailsAction(taskId, { notes: next || null }));
    }
  }

  if (editing) {
    return (
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue(notes ?? "");
            setEditing(false);
          }
        }}
        rows={2}
        placeholder="Add a note..."
        className="w-full resize-none rounded-md border border-input bg-card px-2 py-1.5 text-sm"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${
        notes ? "text-foreground" : "text-muted-foreground/40"
      }`}
    >
      {notes || "+ Note"}
    </button>
  );
}
