"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  uploadProjectFileAction,
  removeTaskAttachmentAction,
  bulkRemoveAttachmentsAction,
  replaceAttachmentAction,
} from "@/lib/actions";
import { UploadCloudIcon, FileTextIcon, FileIcon, VideoIcon, Trash2Icon, RefreshCwIcon } from "lucide-react";

type ProjectFile = {
  id: string;
  url: string | null;
  label: string | null;
  fileSize: number | null;
  uploadedByClient: boolean;
  viaChat: boolean;
  createdAt: Date | string;
  taskTitle: string | null;
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|avi|mkv)$/i;
const PDF_EXT = /\.pdf$/i;

function formatFileSize(bytes: number | null): string | null {
  if (bytes === null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileKindIcon({ label }: { label: string | null }) {
  const Icon = !label ? FileIcon : VIDEO_EXT.test(label) ? VideoIcon : PDF_EXT.test(label) ? FileTextIcon : FileIcon;
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Icon className="size-4" />
    </span>
  );
}

function FileThumbnail({ url, label }: { url: string | null; label: string | null }) {
  const [broken, setBroken] = useState(false);
  const isImage = !!url && !broken && !!label && IMAGE_EXT.test(label);

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private, token-signed Supabase Storage URLs; not a static asset next/image can optimize
      <img
        src={url}
        alt=""
        onError={() => setBroken(true)}
        className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
      />
    );
  }

  return <FileKindIcon label={label} />;
}

const POLL_INTERVAL_MS = 8000;

export function FilesTab({ projectId, files }: { projectId: string; files: ProjectFile[] }) {
  const [liveFiles, setLiveFiles] = useState(files);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ done: number; total: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Adjusting state during render (React's documented pattern) rather than
  // a useEffect when the initial `files` prop changes.
  const [prevFiles, setPrevFiles] = useState(files);
  if (files !== prevFiles) {
    setPrevFiles(files);
    setLiveFiles(files);
  }

  async function refetch() {
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, { cache: "no-store" });
      if (res.ok) setLiveFiles(await res.json());
    } catch (err) {
      console.error("Files refetch failed:", err);
    }
  }

  // Polls a plain REST route so a file uploaded via the Comments thread
  // shows up here without a manual reload — same mechanism (and same
  // reasoning) as the Messages tab's polling.
  useEffect(() => {
    const id = setInterval(async () => {
      // Skip while the browser tab isn't visible — this component stays
      // mounted even when the Files tab isn't the active one (ProjectTabs
      // hides inactive panels with CSS, it doesn't unmount them), so
      // without this guard it polls in the background indefinitely.
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/files`, { cache: "no-store" });
        if (!res.ok) throw new Error(`poll failed: ${res.status}`);
        const fresh: ProjectFile[] = await res.json();
        setLiveFiles((current) => (fresh.length !== current.length ? fresh : current));
      } catch (err) {
        console.error("Files poll failed:", err);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [projectId]);

  // Uploaded one at a time, not all at once — this app's Supabase pooler
  // caps at 15 concurrent connections, and dropping a big batch as
  // concurrent Server Action calls (each opening its own DB connection)
  // has hit that limit before elsewhere in this app. Sequential is a
  // little slower for a big batch but never risks exhausting the pool.
  const uploadFiles = (fileList: FileList | File[]) => {
    const queued = Array.from(fileList);
    if (queued.length === 0) return;
    setUploadStatus({ done: 0, total: queued.length });
    startTransition(async () => {
      for (let i = 0; i < queued.length; i++) {
        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("file", queued[i]);
        await uploadProjectFileAction(formData);
        setUploadStatus({ done: i + 1, total: queued.length });
      }
      setUploadStatus(null);
      await refetch();
    });
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleFiles = search.trim()
    ? liveFiles.filter((f) => (f.label ?? "").toLowerCase().includes(search.trim().toLowerCase()))
    : liveFiles;

  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === visibleFiles.length ? new Set() : new Set(visibleFiles.map((f) => f.id))));
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    if (!confirm(`Remove ${selected.size} file(s)? This can't be undone.`)) return;
    const ids = Array.from(selected);
    setDeleting(true);
    startTransition(async () => {
      await bulkRemoveAttachmentsAction(ids);
      setSelected(new Set());
      setDeleting(false);
      await refetch();
    });
  };

  return (
    <div>
      <div className="app-card mb-4 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Shared Files</h2>
            <p className="text-xs text-muted-foreground">{liveFiles.length} file{liveFiles.length === 1 ? "" : "s"} shared with the client</p>
          </div>
          {liveFiles.length > 0 && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files…"
              className="w-full max-w-56 rounded-md border border-black/15 px-3 py-1.5 text-xs"
            />
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-black/15 bg-muted/40 hover:bg-muted/60"
          }`}
        >
          <UploadCloudIcon className="size-7 text-muted-foreground" />
          <p className="text-sm">
            {uploadStatus ? `Uploading ${uploadStatus.done}/${uploadStatus.total}…` : "Click to upload or drag and drop"}
          </p>
          <p className="text-xs text-muted-foreground">max: 10MB</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*,application/pdf,text/plain"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Shared hidden input for the per-row Replace action — avoids a
            separate file input (and separate DOM ref) per row. */}
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*,video/*,application/pdf,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file || !replacingId) return;
            const formData = new FormData();
            formData.set("attachmentId", replacingId);
            formData.set("file", file);
            startTransition(async () => {
              await replaceAttachmentAction(formData);
              await refetch();
            });
            setReplacingId(null);
          }}
        />

        {liveFiles.length === 0 ? (
          <div className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">No files yet.</div>
        ) : visibleFiles.length === 0 ? (
          <div className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">No files match “{search}”.</div>
        ) : (
          <>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={selected.size === visibleFiles.length}
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                />
                Select all
              </label>
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleBulkDelete}
                    className="rounded-md border border-[#f5cfcf] bg-[#fdf0f0] px-2.5 py-1 text-xs font-semibold text-[#d03b3b] hover:bg-[#fbe6e6] disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Delete selected"}
                  </button>
                </div>
              )}
            </div>

            <div className="divide-y divide-border">
              {visibleFiles.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 rounded-md px-1 py-2.5 text-sm hover:bg-muted/40">
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(f.id)}
                      onChange={() => toggleSelected(f.id)}
                      className="shrink-0 cursor-pointer"
                      aria-label={`Select ${f.label ?? "file"}`}
                    />
                    <FileThumbnail url={f.url} label={f.label} />
                    <div className="min-w-0">
                      {f.url ? (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-medium text-foreground hover:text-link hover:underline"
                        >
                          {f.label || "Untitled file"}
                        </a>
                      ) : (
                        <span className="truncate font-medium text-muted-foreground">
                          {f.label || "Untitled file"} (unavailable)
                        </span>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {[
                          formatFileSize(f.fileSize),
                          f.uploadedByClient
                            ? "Uploaded by client"
                            : f.viaChat
                              ? "via Comments"
                              : f.taskTitle
                                ? `via ${f.taskTitle}`
                                : "Project file",
                          new Date(f.createdAt).toLocaleDateString(),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setReplacingId(f.id);
                        replaceInputRef.current?.click();
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
                      aria-label={`Replace ${f.label ?? "file"}`}
                      title="Replace this file"
                    >
                      <RefreshCwIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          await removeTaskAttachmentAction(f.id);
                          await refetch();
                        })
                      }
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-[#d03b3b]"
                      aria-label={`Remove ${f.label ?? "file"}`}
                    >
                      <Trash2Icon className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
