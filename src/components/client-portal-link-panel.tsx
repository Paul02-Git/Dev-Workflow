"use client";

import { useState, useTransition } from "react";
import { ExternalLinkIcon, UsersIcon } from "lucide-react";
import { sendClientMagicLinkAction, revokeClientInviteLinkAction } from "@/lib/actions";

export function ClientPortalLinkPanel({
  clientId,
  hasEmail,
  fileCount,
  messageCount,
}: {
  clientId: string;
  hasEmail: boolean;
  fileCount: number;
  messageCount: number;
}) {
  const [, startTransition] = useTransition();
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState(false);

  const path = lastToken ? `/api/client-magic/${lastToken}` : null;

  return (
    <div className="app-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#f2effc] text-[#7c5cf0]">
            <UsersIcon className="size-5" />
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Client Workspace</h2>
        </div>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        No password to set up — the client gets a one-click login link by email each time they need one.
      </p>

      <div className="mb-3 flex gap-4 text-xs">
        <span><strong className="font-bold">{fileCount}</strong> file{fileCount === 1 ? "" : "s"} from client</span>
        <span><strong className="font-bold">{messageCount}</strong> comment{messageCount === 1 ? "" : "s"}</span>
      </div>

      {!hasEmail ? (
        <p className="rounded-md border border-[#f5e3b3] bg-[#fef4de] px-3 py-2 text-xs text-[#8a5c00]">
          No email on file — add one before you can send a login link.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={sending}
            onClick={() => {
              setSending(true);
              setSent(false);
              setSendError(false);
              startTransition(async () => {
                try {
                  const token = await sendClientMagicLinkAction(clientId);
                  setLastToken(token);
                  setSent(true);
                } catch {
                  setSendError(true);
                } finally {
                  setSending(false);
                }
              });
            }}
            className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {sending ? "Sending…" : sent ? "Sent — send another" : "Send login link"}
          </button>
          {path && (
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}${path}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 rounded-md border border-black/15 px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:border-link hover:text-link"
            >
              {copied ? "Copied ✓" : "Copy that link"}
            </button>
          )}
        </div>
      )}
      {sendError && (
        <p className="mt-2 text-xs font-medium text-[#d03b3b]">Couldn&apos;t send that email. Try again in a moment.</p>
      )}

      {path && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">Expires 20 minutes after sending.</span>
          <button
            type="button"
            onClick={() => {
              if (confirm("Revoke this link? It will stop working immediately.")) {
                startTransition(() => revokeClientInviteLinkAction(clientId));
                setLastToken(null);
                setSent(false);
              }
            }}
            className="shrink-0 text-xs text-muted-foreground hover:text-[#d03b3b]"
          >
            Revoke
          </button>
        </div>
      )}
      <div className="mt-1.5 text-[11px] text-muted-foreground">
        <ExternalLinkIcon className="mr-1 inline size-3" />
        Different from a project&apos;s Handoff link — this one covers every project this client has.
      </div>
    </div>
  );
}
