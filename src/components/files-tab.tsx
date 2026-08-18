"use client";

import { useState, useTransition } from "react";
import { uploadProjectFileAction, removeTaskAttachmentAction } from "@/lib/actions";

type ProjectFile = {
  id: string;
  url: string | null;
  label: string | null;
  createdAt: Date | string;
  taskTitle: string | null;
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|avi|mkv)$/i;
const PDF_EXT = /\.pdf$/i;

function fileKindIcon(label: string | null): string {
  if (!label) return "📎";
  if (VIDEO_EXT.test(label)) return "🎬";
  if (PDF_EXT.test(label)) return "📄";
  if (/\.(txt|md)$/i.test(label)) return "📝";
  return "📎";
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
        className="h-12 w-12 shrink-0 rounded border border-border object-cover"
      />
    );
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-border bg-white text-xl">
      {fileKindIcon(label)}
    </div>
  );
}

export function FilesTab({ projectId, files }: { projectId: string; files: ProjectFile[] }) {
  const [, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  return (
    <div>
      <div className="mb-4 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold">Files</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Everything uploaded or linked across this project — task proof and general files (logos, briefs,
          contracts) alike.
        </p>
        <form
          action={async (formData) => {
            setUploading(true);
            await uploadProjectFileAction(formData);
            setUploading(false);
          }}
          onSubmit={(e) => {
            // Clear the file input right after the browser has read it into
            // FormData — otherwise the same filename can't be re-selected later.
            const form = e.currentTarget;
            requestAnimationFrame(() => form.reset());
          }}
          className="flex items-center gap-2"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <input
            type="file"
            name="file"
            required
            accept="image/*,video/*,application/pdf,text/plain"
            className="flex-1 text-xs"
          />
          <button
            type="submit"
            disabled={uploading}
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {files.length === 0 && <div className="p-4 text-sm text-muted-foreground">No files yet.</div>}
        {files.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="flex min-w-0 items-center gap-3">
              <FileThumbnail url={f.url} label={f.label} />
              <div className="min-w-0">
                {f.url ? (
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {f.label || "Untitled file"} ↗
                  </a>
                ) : (
                  <span className="font-medium text-muted-foreground">{f.label || "Untitled file"} (unavailable)</span>
                )}
                <div className="text-[11px] text-muted-foreground">
                  {f.taskTitle ? `via ${f.taskTitle}` : "Project file"} · {new Date(f.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => startTransition(() => removeTaskAttachmentAction(f.id))}
              className="shrink-0 text-xs text-muted-foreground hover:text-[#d03b3b]"
              aria-label={`Remove ${f.label ?? "file"}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
