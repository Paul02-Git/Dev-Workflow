"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PaperclipIcon, Trash2Icon, FileIcon } from "lucide-react";
import { postClientCommentAction, uploadClientChatFileAction, deleteClientMessageAction, deleteAllClientMessagesAction } from "@/lib/actions";

type Attachment = { id: string; label: string | null; fileSize: number | null; url: string | null };
type Message = { id: string; authorName: string; body: string; createdAt: Date | string; attachment: Attachment | null };
type ProjectThread = { id: string; name: string; messages: Message[] };

const POLL_INTERVAL_MS = 8000;

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PortalComments({ token, projects }: { token: string; projects: ProjectThread[] }) {
  const [selectedId, setSelectedId] = useState(projects[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [liveMessagesByProject, setLiveMessagesByProject] = useState<Record<string, Message[]>>(() =>
    Object.fromEntries(projects.map((p) => [p.id, p.messages]))
  );
  const selectedProject = projects.find((p) => p.id === selectedId) ?? projects[0];
  const liveMessages = selectedProject ? (liveMessagesByProject[selectedProject.id] ?? selectedProject.messages) : [];
  const threadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refetch(projectId: string) {
    try {
      const res = await fetch(`/api/portal/${token}/projects/${projectId}/messages`, { cache: "no-store" });
      if (res.ok) {
        const fresh: Message[] = await res.json();
        setLiveMessagesByProject((prev) => ({ ...prev, [projectId]: fresh }));
      }
    } catch (err) {
      console.error("Comments refetch failed:", err);
    }
  }

  // Polls a plain REST route (not a Server Action — see
  // /api/projects/[id]/messages/route.ts for why: polling a Server Action
  // on a setInterval was reported as unreliable, twice, despite the
  // underlying query working correctly when called directly). One cheap
  // indexed SELECT per call, not a full page refresh.
  useEffect(() => {
    if (!selectedProject) return;
    const id = selectedProject.id;
    const poll = async () => {
      try {
        const res = await fetch(`/api/portal/${token}/projects/${id}/messages`, { cache: "no-store" });
        if (!res.ok) throw new Error(`poll failed: ${res.status}`);
        const fresh: Message[] = await res.json();
        setLiveMessagesByProject((prev) =>
          fresh.length !== (prev[id]?.length ?? -1) ? { ...prev, [id]: fresh } : prev
        );
      } catch (err) {
        console.error("Comments poll failed:", err);
      }
    };
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, selectedProject]);

  // Jump to the newest message whenever the thread changes (a poll picks
  // up a reply, our own send lands, or the selected project changes) — a
  // real DOM side effect (scrollTop), not a state update, so it belongs in
  // an effect rather than the render-time-adjustment pattern used above.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [liveMessages.length, selectedId]);

  if (!selectedProject) {
    return (
      <section className="flex h-[600px] min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-1 text-sm font-bold">Comments</h2>
        <p className="text-xs text-muted-foreground">You&apos;ll be able to message Paul here once your first project is set up.</p>
      </section>
    );
  }

  const projectId = selectedProject.id;

  function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    const formData = new FormData();
    formData.set("token", token);
    formData.set("projectId", projectId);
    formData.set("body", body);
    startTransition(async () => {
      await postClientCommentAction(formData);
      await refetch(projectId);
    });
  }

  function handleFilePicked(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.set("token", token);
    formData.set("projectId", projectId);
    formData.set("file", file);
    startTransition(async () => {
      try {
        await uploadClientChatFileAction(formData);
        await refetch(projectId);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    });
  }

  function handleDeleteMessage(messageId: string) {
    if (!confirm("Delete this message?")) return;
    setLiveMessagesByProject((prev) => ({ ...prev, [projectId]: liveMessages.filter((m) => m.id !== messageId) }));
    const formData = new FormData();
    formData.set("token", token);
    formData.set("messageId", messageId);
    startTransition(async () => {
      await deleteClientMessageAction(formData);
      await refetch(projectId);
    });
  }

  function handleClearChat() {
    if (!confirm("Delete the entire conversation? This can't be undone.")) return;
    setLiveMessagesByProject((prev) => ({ ...prev, [projectId]: [] }));
    const formData = new FormData();
    formData.set("token", token);
    formData.set("projectId", projectId);
    startTransition(async () => {
      await deleteAllClientMessagesAction(formData);
    });
  }

  return (
    <section className="flex h-[600px] min-w-0 flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold">Comments</h2>
        {liveMessages.length > 0 && (
          <button type="button" onClick={handleClearChat} className="text-xs font-medium text-muted-foreground hover:text-[#d03b3b]">
            Clear chat
          </button>
        )}
      </div>

      {projects.length > 1 && (
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="mb-3 w-full rounded-md border border-black/15 px-2.5 py-2 text-xs font-semibold"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>Re: {p.name}</option>
          ))}
        </select>
      )}

      <div ref={threadRef} className="mb-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
        {liveMessages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments yet — say hello!</p>
        ) : (
          liveMessages.map((m) => {
            const isClient = m.authorName === "Client";
            return (
              <div key={m.id} className={`group flex gap-2 ${isClient ? "flex-row-reverse" : ""}`}>
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ backgroundColor: isClient ? "#a259ff" : "#2a78d6" }}
                >
                  {m.authorName.charAt(0).toUpperCase()}
                </span>
                <div className={`flex min-w-0 max-w-[78%] flex-col gap-0.5 ${isClient ? "items-end" : "items-start"}`}>
                  <div className={`flex items-baseline gap-1.5 text-[11px] text-muted-foreground ${isClient ? "flex-row-reverse" : ""}`}>
                    <span className="font-semibold text-[#52514e]">{m.authorName}</span>
                    <span>{formatTime(m.createdAt)}</span>
                  </div>
                  {m.attachment ? (
                    <a
                      href={m.attachment.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs hover:border-primary ${isClient ? "border-transparent bg-[#eef2fb]" : "border-black/10 bg-background"}`}
                    >
                      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{m.attachment.label ?? "File"}</span>
                      <span className="shrink-0 text-muted-foreground">{formatFileSize(m.attachment.fileSize)}</span>
                    </a>
                  ) : (
                    <div className={`max-w-full whitespace-pre-wrap break-words rounded-xl border px-3 py-2 text-sm ${isClient ? "border-transparent bg-[#eef2fb]" : "border-black/10 bg-background"}`}>
                      {m.body}
                    </div>
                  )}
                </div>
                {isClient && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(m.id)}
                    aria-label="Delete message"
                    className="shrink-0 self-center rounded p-1 text-muted-foreground opacity-0 hover:text-[#d03b3b] group-hover:opacity-100"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-black/10 pt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a comment…"
          className="min-h-[60px] w-full rounded-md border border-black/15 px-3 py-2 text-sm"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleFilePicked(file);
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach a file"
            title="Attach a file"
            className="flex items-center gap-1.5 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary disabled:opacity-50"
          >
            <PaperclipIcon className="size-4" />
            {uploading && <span className="text-xs">Uploading…</span>}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Paul usually replies within a day</span>
            <button
              type="button"
              disabled={pending || !draft.trim()}
              onClick={handleSend}
              className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
