"use client";

import { useState, useTransition } from "react";
import {
  updateTaskDetailsAction,
  addTaskTagAction,
  removeTaskTagAction,
  addTaskAttachmentAction,
  removeTaskAttachmentAction,
  uploadTaskAttachmentAction,
  setTaskWaitingOnClientAction,
} from "@/lib/actions";

type Tag = { id: string; name: string };
// url here is always a ready-to-use link — resolved server-side (signed URL
// for uploaded files, verbatim for pasted external links) before this
// component ever sees it.
type Attachment = { id: string; url: string | null; label: string | null };

function toDateInputValue(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

export function TaskDetailsToggle({
  taskId,
  notes,
  dueDate,
  assignee,
  tags,
  attachments,
  isWaitingOnClient,
}: {
  taskId: string;
  notes: string | null;
  dueDate: Date | string | null;
  assignee: string | null;
  tags: Tag[];
  attachments: Attachment[];
  isWaitingOnClient?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasDetails = !!notes || !!dueDate || !!assignee || tags.length > 0 || attachments.length > 0 || !!isWaitingOnClient;

  return (
    <div>
      {isWaitingOnClient && (
        <span className="mr-1.5 rounded-full bg-[#fef4de] px-1.5 py-0.5 text-[10px] font-bold text-[#8a5c00]">
          WAITING ON CLIENT
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-medium text-primary hover:underline"
      >
        {open ? "Hide details" : hasDetails ? "Details •" : "Add details"}
      </button>
      {open && (
        <TaskDetailsPanel
          taskId={taskId}
          notes={notes}
          dueDate={dueDate}
          assignee={assignee}
          tags={tags}
          attachments={attachments}
          isWaitingOnClient={!!isWaitingOnClient}
        />
      )}
    </div>
  );
}

function TaskDetailsPanel({
  taskId,
  notes,
  dueDate,
  assignee,
  tags,
  attachments,
  isWaitingOnClient,
}: {
  taskId: string;
  notes: string | null;
  dueDate: Date | string | null;
  assignee: string | null;
  tags: Tag[];
  attachments: Attachment[];
  isWaitingOnClient: boolean;
}) {
  const [, startTransition] = useTransition();
  const [notesValue, setNotesValue] = useState(notes ?? "");
  const [newTag, setNewTag] = useState("");
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
  const [newAttachmentLabel, setNewAttachmentLabel] = useState("");
  const [waiting, setWaiting] = useState(isWaitingOnClient);

  return (
    <div className="mt-2 space-y-3 rounded-md border border-border bg-white p-3">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={waiting}
          onChange={(e) => {
            setWaiting(e.target.checked);
            startTransition(() => setTaskWaitingOnClientAction(taskId, e.target.checked));
          }}
        />
        Waiting on client
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">Due date</span>
          <input
            type="date"
            defaultValue={toDateInputValue(dueDate)}
            onChange={(e) =>
              startTransition(() => updateTaskDetailsAction(taskId, { dueDate: e.target.value }))
            }
            className="w-full rounded border border-black/15 px-2 py-1 text-xs"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">Assignee</span>
          <input
            type="text"
            defaultValue={assignee ?? ""}
            onBlur={(e) =>
              startTransition(() => updateTaskDetailsAction(taskId, { assignee: e.target.value || null }))
            }
            placeholder="Unassigned"
            className="w-full rounded border border-black/15 px-2 py-1 text-xs"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">Notes</span>
        <textarea
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          onBlur={() => startTransition(() => updateTaskDetailsAction(taskId, { notes: notesValue || null }))}
          rows={2}
          className="w-full rounded border border-black/15 px-2 py-1 text-xs"
        />
      </label>

      <div>
        <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">Tags</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="flex items-center gap-1 rounded-full bg-[#eef2fb] px-2 py-0.5 text-[10px] font-medium text-[#2a4d8f]"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => startTransition(() => removeTaskTagAction(taskId, tag.id))}
                className="text-[#2a4d8f]/60 hover:text-[#2a4d8f]"
                aria-label={`Remove tag ${tag.name}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTag.trim()) {
                e.preventDefault();
                startTransition(() => addTaskTagAction(taskId, newTag.trim()));
                setNewTag("");
              }
            }}
            placeholder="+ tag"
            className="w-16 rounded border border-black/15 px-1.5 py-0.5 text-[10px]"
          />
        </div>
      </div>

      <div>
        <span className="mb-1 block text-[10px] font-semibold text-muted-foreground">Attachments</span>
        <div className="space-y-1">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs">
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
        <div className="mt-1 flex gap-1.5">
          <input
            type="text"
            value={newAttachmentLabel}
            onChange={(e) => setNewAttachmentLabel(e.target.value)}
            placeholder="Label"
            className="w-20 rounded border border-black/15 px-1.5 py-0.5 text-[10px]"
          />
          <input
            type="text"
            value={newAttachmentUrl}
            onChange={(e) => setNewAttachmentUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 rounded border border-black/15 px-1.5 py-0.5 text-[10px]"
          />
          <button
            type="button"
            disabled={!newAttachmentUrl.trim()}
            onClick={() => {
              startTransition(() => addTaskAttachmentAction(taskId, newAttachmentUrl.trim(), newAttachmentLabel.trim()));
              setNewAttachmentUrl("");
              setNewAttachmentLabel("");
            }}
            className="rounded border border-black/15 px-2 text-[10px] font-medium disabled:opacity-40"
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
            className="flex-1 text-[10px]"
          />
          <button type="submit" className="rounded border border-black/15 px-2 text-[10px] font-medium">
            Upload
          </button>
        </form>
      </div>
    </div>
  );
}
