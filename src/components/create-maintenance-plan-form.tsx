"use client";

import { useState } from "react";
import { createMaintenancePlanAction } from "@/lib/actions";

export function CreateMaintenancePlanForm({
  projects,
  defaultChecklist,
  lockedProjectId,
}: {
  projects: { id: string; name: string; clientName: string }[];
  defaultChecklist: string;
  /** When set (e.g. embedded in a single project's Settings tab), skips the project picker entirely. */
  lockedProjectId?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        + New maintenance plan
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await createMaintenancePlanAction(formData);
        setOpen(false);
      }}
      className="mb-6 space-y-3 rounded-xl border border-border bg-card p-5"
    >
      <h2 className="text-sm font-semibold">New maintenance plan</h2>
      <div className="grid grid-cols-2 gap-3">
        {lockedProjectId ? (
          <input type="hidden" name="projectId" value={lockedProjectId} />
        ) : (
          <select name="projectId" required className="rounded-md border border-black/15 px-3 py-2 text-sm">
            <option value="">Select project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.clientName}
              </option>
            ))}
          </select>
        )}
        <input
          type="text"
          name="name"
          required
          defaultValue="Monthly Maintenance"
          className="rounded-md border border-black/15 px-3 py-2 text-sm"
        />
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">Cadence (days)</span>
        <input
          type="number"
          name="cadenceDays"
          min={1}
          defaultValue={30}
          className="w-24 rounded-md border border-black/15 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">Checklist (one item per line)</span>
        <textarea
          name="checklistTemplate"
          defaultValue={defaultChecklist}
          rows={7}
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
        />
      </label>
      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Create plan
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}
