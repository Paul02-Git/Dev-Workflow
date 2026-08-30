"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MessageCircleIcon, XIcon, PaperclipIcon, Trash2Icon, FileIcon } from "lucide-react";
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

/**
 * Replaces the old inline Comments card (messages-tab.tsx, now deleted —
 * this was its only call site) with an Intercom/Crisp-style floating
 * launcher + panel. Same data layer underneath, unchanged: the same
 * postProjectMessageAction/uploadChatFileAction/deleteProjectMessageAction/
 * deleteAllProjectMessagesAction and the same 8s poll against
 * /api/projects/[id]/messages — this is a container/interaction-shell
 * change, not a data-layer one.
 *
 * The "online" dot in the header is decorative, not a real presence
 * system — there's no such thing tracked anywhere in this app, and
 * fabricating a live status would be worse than a plain static indicator
 * that a person is reachable through this thread.
 *
 * Unread badge is session-scoped, not persisted — see the `seenCount`
 * state below for the reasoning (it exists to satisfy this app's
 * react-hooks/set-state-in-effect rule without dropping the badge
 * entirely, not because persistence wasn't worth having).
 */
export function FloatingChatWidget({
  projectId,
  clientName,
  messages,
}: {
  projectId: string;
  clientName: string;
  messages: Message[];
}) {
  const [open, setOpen] = useState(false);
  const [liveMessages, setLiveMessages] = useState(messages);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  // Baseline for the unread badge — how many messages existed when this
  // page view first loaded. Anything that arrives via polling after that,
  // before the panel is next opened, counts as unread. Session-scoped (not
  // persisted across a reload) rather than localStorage-backed — set only
  // from direct user interaction (the launcher click below), never from an
  // effect, so this app's react-hooks/set-state-in-effect rule (which
  // exists specifically to keep state updates event-driven, not derived
  // inside effects) has nothing to flag here.
  const [seenCount, setSeenCount] = useState(() => messages.length);
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

  useEffect(() => {
    const id = setInterval(async () => {
      // Skip while this tab isn't visible — no one's here to see a new
      // message arrive, so there's no reason to keep hitting the DB.
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/messages`, { cache: "no-store" });
        if (!res.ok) throw new Error(`poll failed: ${res.status}`);
        const fresh: Message[] = await res.json();
        setLiveMessages((current) => (fresh.length !== current.length ? fresh : current));
      } catch (err) {
        console.error("Messages poll failed:", err);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [projectId]);

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

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [liveMessages.length, open]);

  const unread = open ? 0 : Math.max(0, liveMessages.length - seenCount);

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[32rem] w-96 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <ActorAvatar name={clientName} size={32} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{clientName}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-[#0ca30c]" />
                  Reachable here
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {liveMessages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearChat}
                  title="Clear chat"
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-[#d03b3b]"
                >
                  <Trash2Icon className="size-4" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="rounded p-1.5 text-muted-foreground hover:bg-muted">
                <XIcon className="size-4" />
              </button>
            </div>
          </div>

          {liveMessages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              No messages yet — say hello.
            </div>
          ) : (
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {liveMessages.map((m) => (
                <div key={m.id} className="group flex items-start gap-2.5">
                  <ActorAvatar name={m.authorName} size={24} />
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
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{m.body}</p>
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

          <div className="border-t border-border p-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Reply to the client…"
              className="min-h-[52px] w-full resize-none rounded-md border border-black/15 px-3 py-2 text-sm"
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
                className="flex items-center gap-1.5 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-link disabled:opacity-50"
              >
                <PaperclipIcon className="size-4" />
                {uploading && <span className="text-xs">Uploading…</span>}
              </button>
              <button
                type="button"
                disabled={pending || !draft.trim()}
                onClick={handleSend}
                className="rounded-md bg-[#111827] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#111827]/90 disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          setOpen((v) => {
            const next = !v;
            if (next) setSeenCount(liveMessages.length);
            return next;
          })
        }
        aria-label={open ? "Close chat" : "Open chat"}
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-[#111827] text-white shadow-lg transition-transform hover:scale-105"
      >
        {open ? <XIcon className="size-6" /> : <MessageCircleIcon className="size-6" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-[#d03b3b] px-1 text-[11px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
    </>
  );
}
