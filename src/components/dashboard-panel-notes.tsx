"use client";

import { useState, useTransition } from "react";
import { updateProjectNotesAction } from "@/lib/actions";

export function DashboardPanelNotes({ projectId, notes }: { projectId: string; notes: string | null }) {
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(notes ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Notes</h3>
        {saved && <span className="text-xs font-semibold text-[#0ca30c]">Saved</span>}
      </div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onBlur={() => {
          startTransition(async () => {
            await updateProjectNotesAction(projectId, value);
            setSaved(true);
          });
        }}
        rows={4}
        placeholder="Client prefers minimalist design with light colors…"
        className="w-full rounded-md border border-black/15 px-3 py-2 text-xs"
      />
    </div>
  );
}
