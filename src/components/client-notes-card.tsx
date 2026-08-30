"use client";

import { useState, useTransition } from "react";
import { ActorAvatar } from "@/components/actor-avatar";
import { relativeTime } from "@/lib/format-activity";
import { createProjectNoteAction } from "@/lib/actions";

type Note = { id: string; authorName: string; body: string; createdAt: Date | string };

/**
 * Internal-only running notes log — communication preferences, meeting
 * notes, client requests. Never read by any client-facing query (handoff
 * page, portal) — a genuinely separate table (project_notes) from the
 * existing single-textarea Notes tab, which stays untouched.
 */
export function ClientNotesCard({ projectId, notes }: { projectId: string; notes: Note[] }) {
  const [liveNotes, setLiveNotes] = useState(notes);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    const body = draft.trim();
    if (!body) return;
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("body", body);
    startTransition(async () => {
      const note = await createProjectNoteAction(formData);
      if (note) setLiveNotes((prev) => [note, ...prev]);
      setDraft("");
      setAdding(false);
    });
  }

  return (
    <div className="app-card p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Client Notes</h2>
        <button type="button" onClick={() => setAdding((v) => !v)} className="text-xs font-semibold text-primary hover:underline">
          + Add Note
        </button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Internal — not visible to the client.</p>

      {adding && (
        <div className="mb-3 border-b border-border pb-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Communication preferences, meeting notes, client requests…"
            autoFocus
            className="min-h-[60px] w-full rounded-md border border-black/15 px-3 py-2 text-sm"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => { setAdding(false); setDraft(""); }} className="text-xs text-muted-foreground hover:underline">
              Cancel
            </button>
            <button
              type="button"
              disabled={pending || !draft.trim()}
              onClick={handleAdd}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>
      )}

      {liveNotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {liveNotes.map((note) => (
            <li key={note.id} className="flex items-start gap-2.5">
              <ActorAvatar name={note.authorName} size={26} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 text-xs">
                  <span className="font-semibold">{note.authorName}</span>
                  <span className="text-muted-foreground">{relativeTime(note.createdAt)}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{note.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
