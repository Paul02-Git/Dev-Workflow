"use client";

import { useRef, useState } from "react";
import { createTaskAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";

export function AddTaskForm({
  projectId,
  stages,
  triggerClassName,
}: {
  projectId: string;
  stages: readonly { key: string; name: string }[];
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        <PlusIcon data-icon="inline-start" />
        New Task
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await createTaskAction(formData);
        formRef.current?.reset();
        setOpen(false);
      }}
      className="flex flex-wrap items-center gap-2 rounded-md border border-black/15 bg-white p-2"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input
        type="text"
        name="title"
        required
        autoFocus
        placeholder="Task title…"
        className="min-w-[220px] flex-1 rounded border border-black/15 px-2 py-1 text-sm"
      />
      <select name="stageKey" required className="rounded border border-black/15 px-2 py-1 text-xs">
        {stages.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name}
          </option>
        ))}
      </select>
      <select name="priority" defaultValue="MEDIUM" className="rounded border border-black/15 px-2 py-1 text-xs">
        <option value="CRITICAL">Critical</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Medium</option>
        <option value="LOW">Low</option>
      </select>
      <label className="flex items-center gap-1 text-xs text-[#52514e]">
        <input type="checkbox" name="isCritical" className="accent-primary" />
        Critical
      </label>
      <button
        type="submit"
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-muted-foreground hover:underline"
      >
        Cancel
      </button>
    </form>
  );
}
