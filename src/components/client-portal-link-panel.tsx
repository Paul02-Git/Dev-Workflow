"use client";

import { useState, useTransition } from "react";
import { ExternalLinkIcon, UsersIcon } from "lucide-react";
import { generateClientInviteLinkAction, revokeClientInviteLinkAction } from "@/lib/actions";

export function ClientPortalLinkPanel({
  clientId,
  inviteToken,
  hasPassword,
  loginSlug,
  fileCount,
  messageCount,
}: {
  clientId: string;
  inviteToken: string | null;
  hasPassword: boolean;
  loginSlug: string | null;
  fileCount: number;
  messageCount: number;
}) {
  const [, startTransition] = useTransition();
  const [currentToken, setCurrentToken] = useState(inviteToken);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Relative path only — identical server/client, avoids the same
  // hydration-mismatch class of bug HandoffLinkPanel already hit earlier
  // this project (absolute URL needs window.location, computed on click).
  const path = currentToken ? `/client-invite/${currentToken}` : null;

  return (
    <div className="app-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#f2effc] text-[#7c5cf0]">
            <UsersIcon className="size-5" />
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Client Workspace</h2>
        </div>
        {hasPassword && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#0ca30c]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0ca30c]" />
            Account active
          </span>
        )}
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        The client logs in with their own password to see their projects, files, and comments. No preview link — once
        they have an account, only they can see their workspace.
      </p>

      {hasPassword && (
        <div className="mb-3 flex gap-4 text-xs">
          <span><strong className="font-bold">{fileCount}</strong> file{fileCount === 1 ? "" : "s"} from client</span>
          <span><strong className="font-bold">{messageCount}</strong> comment{messageCount === 1 ? "" : "s"}</span>
        </div>
      )}

      {hasPassword ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-xs">
          <span>
            Logs in as <strong className="font-bold">{loginSlug}</strong>
          </span>
          <button
            type="button"
            disabled={generating}
            onClick={() => {
              if (!confirm("Send a new setup link? The client will need to set a new password to use it.")) return;
              setGenerating(true);
              startTransition(async () => {
                const newToken = await generateClientInviteLinkAction(clientId);
                setCurrentToken(newToken);
                setGenerating(false);
              });
            }}
            className="shrink-0 rounded-md border border-black/15 px-2.5 py-1 font-semibold text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {generating ? "Generating…" : "Reset password"}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-black/15 bg-white px-3 py-2 text-xs">
            {path ?? "Not generated yet"}
          </code>
          <button
            type="button"
            disabled={generating}
            onClick={async () => {
              if (currentToken) {
                if (path) {
                  await navigator.clipboard.writeText(`${window.location.origin}${path}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }
                return;
              }
              setGenerating(true);
              startTransition(async () => {
                const newToken = await generateClientInviteLinkAction(clientId);
                setCurrentToken(newToken);
                setGenerating(false);
              });
            }}
            className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {currentToken ? (copied ? "Copied ✓" : "Copy invite link") : generating ? "Generating…" : "Generate invite link"}
          </button>
        </div>
      )}

      {currentToken && !hasPassword && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">Send this link so they can set their password.</span>
          <button
            type="button"
            onClick={() => {
              if (confirm("Revoke this invite link? It will stop working immediately.")) {
                startTransition(() => revokeClientInviteLinkAction(clientId));
                setCurrentToken(null);
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
