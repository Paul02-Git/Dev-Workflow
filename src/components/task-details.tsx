"use client";

import { useState, useTransition } from "react";
import {
  updateTaskDetailsAction,
  addTaskAttachmentAction,
  removeTaskAttachmentAction,
  uploadTaskAttachmentAction,
} from "@/lib/actions";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// url here is always a ready-to-use link — resolved server-side (signed URL
// for uploaded files, verbatim for pasted external links) before this
// component ever sees it.
type Attachment = { id: string; url: string | null; label: string | null };

function toDateInputValue(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

/**
 * "Waiting on client" moved to a one-click toggle on the row itself
 * (TaskWaitingToggle) — no longer part of this panel. Assignee and free
 * tags were dropped entirely: neither is ever filtered/searched anywhere
 * in the app, so they were pure clutter on a solo-user tool. What's left
 * (due date, notes, attachments) opens in a modal instead of an inline
 * accordion, so the row stays a fixed height regardless of how many task
 * rows have details open.
 */
export function TaskDetailsToggle({
  taskId,
  notes,
  dueDate,
  attachments,
}: {
  taskId: string;
  notes: string | null;
  dueDate: Date | string | null;
  attachments: Attachment[];
}) {
  const hasDetails = !!notes || !!dueDate || attachments.length > 0;

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button type="button" className="text-[11px] font-medium text-primary hover:underline">
            {hasDetails ? "Details •" : "Add details"}
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Task details</DialogTitle>
        </DialogHeader>
        <TaskDetailsForm taskId={taskId} notes={notes} dueDate={dueDate} attachments={attachments} />
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailsForm({
  taskId,
  notes,
  dueDate,
  attachments,
}: {
  taskId: string;
  notes: string | null;
  dueDate: Date | string | null;
  attachments: Attachment[];
}) {
  const [, startTransition] = useTransition();
  const [notesValue, setNotesValue] = useState(notes ?? "");
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
  const [newAttachmentLabel, setNewAttachmentLabel] = useState("");

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">Due date</span>
        <input
          type="date"
          defaultValue={toDateInputValue(dueDate)}
          onChange={(e) => startTransition(() => updateTaskDetailsAction(taskId, { dueDate: e.target.value }))}
          className="w-full rounded border border-black/15 px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">Notes</span>
        <textarea
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          onBlur={() => startTransition(() => updateTaskDetailsAction(taskId, { notes: notesValue || null }))}
          rows={4}
          className="w-full rounded border border-black/15 px-2 py-1.5 text-sm"
        />
      </label>

      <div>
        <span className="mb-1 block text-xs font-semibold text-muted-foreground">Attachments</span>
        <div className="space-y-1">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-sm">
              {a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-primary hover:underline"
                >
                  {a.label || a.url}
                </a>
              ) : (
                <span className="truncate text-muted-foreground">{a.label || "(link unavailable)"}</span>
              )}
              <button
                type="button"
                onClick={() => startTransition(() => removeTaskAttachmentAction(a.id))}
                className="text-muted-foreground hover:text-[#d03b3b]"
                aria-label="Remove attachment"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <input
            type="text"
            value={newAttachmentLabel}
            onChange={(e) => setNewAttachmentLabel(e.target.value)}
            placeholder="Label"
            className="w-24 rounded border border-black/15 px-2 py-1 text-xs"
          />
          <input
            type="text"
            value={newAttachmentUrl}
            onChange={(e) => setNewAttachmentUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 rounded border border-black/15 px-2 py-1 text-xs"
          />
          <button
            type="button"
            disabled={!newAttachmentUrl.trim()}
            onClick={() => {
              startTransition(() => addTaskAttachmentAction(taskId, newAttachmentUrl.trim(), newAttachmentLabel.trim()));
              setNewAttachmentUrl("");
              setNewAttachmentLabel("");
            }}
            className="rounded border border-black/15 px-2.5 text-xs font-medium disabled:opacity-40"
          >
            Add
          </button>
        </div>
        <form
          action={uploadTaskAttachmentAction}
          className="mt-1.5 flex items-center gap-1.5"
          onSubmit={(e) => {
            // Clear the file input right after the browser has read it into
            // FormData — otherwise the same filename can't be re-selected later.
            const form = e.currentTarget;
            requestAnimationFrame(() => form.reset());
          }}
        >
          <input type="hidden" name="taskId" value={taskId} />
          <input
            type="file"
            name="file"
            required
            accept="image/*,video/*,application/pdf,text/plain"
            className="flex-1 text-xs"
          />
          <button type="submit" className="rounded border border-black/15 px-2.5 py-1 text-xs font-medium">
            Upload
          </button>
        </form>
      </div>
    </div>
  );
}
