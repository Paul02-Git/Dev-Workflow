"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { uploadClientProjectFileAction, deleteClientFileAction } from "@/lib/actions";

type ClientFile = { id: string; label: string | null; fileSize: number | null; url: string | null; createdAt: Date | string };

const POLL_INTERVAL_MS = 8000;

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Polls the Files list — same reasoning and mechanism as PortalComments and
 * the internal Files tab: a file shared via chat (from either side) needs
 * to show up here without a manual page reload.
 */
export function PortalFiles({
  token,
  projectId,
  initialFiles,
  mode,
}: {
  token: string;
  projectId: string;
  initialFiles: ClientFile[];
  mode: "preview" | "full";
}) {
  const [files, setFiles] = useState(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prevInitial, setPrevInitial] = useState(initialFiles);
  if (initialFiles !== prevInitial) {
    setPrevInitial(initialFiles);
    setFiles(initialFiles);
  }

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/portal/${token}/projects/${projectId}/files`, { cache: "no-store" });
        if (!res.ok) throw new Error(`poll failed: ${res.status}`);
        const fresh: ClientFile[] = await res.json();
        setFiles((current) => (fresh.length !== current.length ? fresh : current));
      } catch (err) {
        console.error("Files poll failed:", err);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token, projectId]);

  function handleFilePicked(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.set("token", token);
    formData.set("projectId", projectId);
    formData.set("file", file);
    startTransition(async () => {
      try {
        await uploadClientProjectFileAction(formData);
        const res = await fetch(`/api/portal/${token}/projects/${projectId}/files`, { cache: "no-store" });
        if (res.ok) setFiles(await res.json());
      } catch (err) {
        alert(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    });
  }

  function handleDelete(attachmentId: string) {
    if (!confirm("Remove this file? This can't be undone.")) return;
    setFiles((prev) => prev.filter((f) => f.id !== attachmentId));
    const formData = new FormData();
    formData.set("token", token);
    formData.set("attachmentId", attachmentId);
    startTransition(async () => {
      await deleteClientFileAction(formData);
      const res = await fetch(`/api/portal/${token}/projects/${projectId}/files`, { cache: "no-store" });
      if (res.ok) setFiles(await res.json());
    });
  }

  if (mode === "preview") {
    return (
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">Files</h2>
        </div>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files shared yet — you can upload one from the Files tab above.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {files.slice(0, 3).map((f) => (
              <a
                key={f.id}
                href={f.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-black/10 bg-background p-2.5 text-xs hover:border-primary"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#eef2fb] text-[10px] font-bold text-primary">FILE</span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{f.label ?? "Untitled"}</div>
                  <div className="text-muted-foreground">{formatFileSize(f.fileSize)}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-bold">Files</h2>
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-dashed border-black/15 bg-background p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf,text/plain"
          className="text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleFilePicked(file);
          }}
        />
        {(uploading || pending) && <span className="ml-auto shrink-0 text-xs text-muted-foreground">Uploading…</span>}
      </div>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files shared yet.</p>
      ) : (
        <div className="divide-y divide-black/10">
          {files.map((f) => (
            <div key={f.id} className="group flex items-center justify-between gap-2 py-2.5 text-sm">
              <a href={f.url ?? undefined} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate font-semibold hover:text-primary hover:underline">
                {f.label ?? "Untitled"}
              </a>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(f.fileSize)} · {formatDate(f.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(f.id)}
                  aria-label="Remove file"
                  className="rounded p-1 text-muted-foreground opacity-0 hover:text-[#d03b3b] group-hover:opacity-100"
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
