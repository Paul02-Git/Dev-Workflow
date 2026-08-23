"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PaperclipIcon, Trash2Icon, FileIcon } from "lucide-react";
import { ActorAvatar } from "@/components/actor-avatar";
import { relativeTime } from "@/lib/format-activity";
import { postProjectMessageAction, uploadChatFileAction, deleteProjectMessageAction, deleteAllProjectMessagesAction } from "@/lib/actions";

type Attachment = { id: string; label: string | null; fileSize: number | null; url: string | null };
type Message = { id: string; authorName: string; body: string; createdAt: Date | string; attachment: Attachment | null };

const POLL_INTERVAL_MS = 8000;

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessagesTab({ projectId, messages }: { projectId: string; messages: Message[] }) {
  const [liveMessages, setLiveMessages] = useState(messages);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refetch() {
    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, { cache: "no-store" });
      if (res.ok) setLiveMessages(await res.json());
    } catch (err) {
      console.error("Messages refetch failed:", err);
    }
  }

  // Polls a plain REST route (not a Server Action — that was tried twice
  // and reported as "not realtime" both times despite the underlying query
  // working correctly when called directly, so this switches to the
  // standard, easy-to-verify mechanism: a fetch() any browser dev tools
  // Network tab can show directly). One cheap indexed SELECT per call, not
  // a full page refresh — this tab lives inside a page that already fires
  // 8 queries per load.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/messages`, { cache: "no-store" });
        if (!res.ok) throw new Error(`poll failed: ${res.status}`);
        const fresh: Message[] = await res.json();
        setLiveMessages((current) => (fresh.length !== current.length ? fresh : current));
      } catch (err) {
        // Surfaced to the console deliberately — a silent failure here
        // looks identical to "not realtime" from the UI, with no signal
        // pointing at why.
        console.error("Messages poll failed:", err);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [projectId]);

  // Adjusting state during render (React's documented pattern) rather than
  // a useEffect when the initial `messages` prop changes — this app's
  // eslint config flags setState-in-effect as a cascading-render risk.
  const [prevMessages, setPrevMessages] = useState(messages);
  if (messages !== prevMessages) {
    setPrevMessages(messages);
    setLiveMessages(messages);
  }

  function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("body", body);
    startTransition(async () => {
      await postProjectMessageAction(formData);
      await refetch();
    });
  }

  function handleFilePicked(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("file", file);
    startTransition(async () => {
      try {
        await uploadChatFileAction(formData);
        await refetch();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    });
  }

  function handleDeleteMessage(messageId: string) {
    if (!confirm("Delete this message?")) return;
    setLiveMessages((prev) => prev.filter((m) => m.id !== messageId));
    const formData = new FormData();
    formData.set("messageId", messageId);
    startTransition(async () => {
      await deleteProjectMessageAction(formData);
      await refetch();
    });
  }

  function handleClearChat() {
    if (!confirm("Delete the entire conversation? This can't be undone.")) return;
    setLiveMessages([]);
    startTransition(async () => {
      await deleteAllProjectMessagesAction(projectId);
    });
  }

  // Jump to the newest message on any change — a real DOM side effect
  // (scrollTop), so it belongs in an effect rather than the render-time
  // state-adjustment pattern used above.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [liveMessages.length]);

  return (
    <div className="app-card p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Comments</h2>
        {liveMessages.length > 0 && (
          <button
            type="button"
            onClick={handleClearChat}
            className="text-xs font-medium text-muted-foreground hover:text-[#d03b3b]"
          >
            Clear chat
          </button>
        )}
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        A two-way thread with the client — visible on their Client Portal too, if they have one.
      </p>

      {liveMessages.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <div ref={listRef} className="mb-4 max-h-64 space-y-3 overflow-y-auto">
          {liveMessages.map((m) => (
            <div key={m.id} className="group flex items-start gap-2.5">
              <ActorAvatar name={m.authorName} size={26} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 text-xs">
                  <span className="font-semibold">{m.authorName}</span>
                  <span className="text-muted-foreground">{relativeTime(m.createdAt)}</span>
                </div>
                {m.attachment ? (
                  <a
                    href={m.attachment.url ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-2 rounded-md border border-black/10 bg-background px-2.5 py-1.5 text-xs hover:border-primary"
                  >
                    <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{m.attachment.label ?? "File"}</span>
                    <span className="shrink-0 text-muted-foreground">{formatFileSize(m.attachment.fileSize)}</span>
                  </a>
                ) : (
                  <p className="mt-0.5 text-sm">{m.body}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteMessage(m.id)}
                aria-label="Delete message"
                className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:text-[#d03b3b] group-hover:opacity-100"
              >
                <Trash2Icon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border pt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Reply to the client…"
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
          <button
            type="button"
            disabled={pending || !draft.trim()}
            onClick={handleSend}
            className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
