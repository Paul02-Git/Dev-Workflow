"use client";

import { useState, useTransition } from "react";
import { updateProjectNotesAction } from "@/lib/actions";

export function NotesTab({ projectId, notes }: { projectId: string; notes: string | null }) {
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(notes ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Notes</h2>
        {saved && <span className="text-[11px] font-medium text-[#0ca30c]">Saved</span>}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        A scratchpad for anything worth remembering about this project — client preferences, quirks, things
        not to forget. Saves automatically.
      </p>
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
        rows={14}
        placeholder="Client prefers WhatsApp over email&#10;Uses Cloudflare&#10;Do not launch on a Friday"
        className="w-full rounded border border-black/15 px-3 py-2 text-sm"
      />
    </div>
  );
}
