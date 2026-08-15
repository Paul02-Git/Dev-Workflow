"use client";

import { useState, useTransition } from "react";
import {
  updateTaskDetailsAction,
  addTaskTagAction,
  removeTaskTagAction,
  addTaskAttachmentAction,
  removeTaskAttachmentAction,
} from "@/lib/actions";

type Tag = { id: string; name: string };
type Attachment = { id: string; url: string; label: string | null };

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
}: {
  taskId: string;
  notes: string | null;
  dueDate: Date | string | null;
  assignee: string | null;
  tags: Tag[];
  attachments: Attachment[];
}) {
  const [open, setOpen] = useState(false);
  const hasDetails = !!notes || !!dueDate || !!assignee || tags.length > 0 || attachments.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-medium text-[#2a78d6] hover:underline"
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
}: {
  taskId: string;
  notes: string | null;
  dueDate: Date | string | null;
  assignee: string | null;
  tags: Tag[];
  attachments: Attachment[];
}) {
  const [, startTransition] = useTransition();
  const [notesValue, setNotesValue] = useState(notes ?? "");
  const [newTag, setNewTag] = useState("");
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
  const [newAttachmentLabel, setNewAttachmentLabel] = useState("");

  return (
    <div className="mt-2 space-y-3 rounded-md border border-black/10 bg-white p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold text-[#898781]">Due date</span>
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
          <span className="mb-1 block text-[10px] font-semibold text-[#898781]">Assignee</span>
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
        <span className="mb-1 block text-[10px] font-semibold text-[#898781]">Notes</span>
        <textarea
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          onBlur={() => startTransition(() => updateTaskDetailsAction(taskId, { notes: notesValue || null }))}
          rows={2}
          className="w-full rounded border border-black/15 px-2 py-1 text-xs"
        />
      </label>

      <div>
        <span className="mb-1 block text-[10px] font-semibold text-[#898781]">Tags</span>
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
        <span className="mb-1 block text-[10px] font-semibold text-[#898781]">Attachments</span>
        <div className="space-y-1">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs">
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-[#2a78d6] hover:underline"
              >
                {a.label || a.url}
              </a>
              <button
                type="button"
                onClick={() => startTransition(() => removeTaskAttachmentAction(a.id))}
                className="text-[#898781] hover:text-[#d03b3b]"
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
      </div>
    </div>
  );
}
