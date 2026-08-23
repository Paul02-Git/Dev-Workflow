"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLinkIcon, ArrowRightIcon, UsersIcon } from "lucide-react";
import { generateClientPortalLinkAction, revokeClientPortalLinkAction } from "@/lib/actions";

export function ClientPortalLinkPanel({
  clientId,
  token,
  fileCount,
  messageCount,
}: {
  clientId: string;
  token: string | null;
  fileCount: number;
  messageCount: number;
}) {
  const [, startTransition] = useTransition();
  const [currentToken, setCurrentToken] = useState(token);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Relative path only — identical server/client, avoids the same
  // hydration-mismatch class of bug HandoffLinkPanel already hit earlier
  // this project (absolute URL needs window.location, computed on click).
  const path = currentToken ? `/portal/${currentToken}` : null;
  const active = !!currentToken;

  return (
    <div className="app-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#f2effc] text-[#7c5cf0]">
            <UsersIcon className="size-5" />
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Client Portal</h2>
        </div>
        {active && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#0ca30c]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0ca30c]" />
            Active
          </span>
        )}
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        A dashboard of every project this client has — they can keep their own contact info current, upload files,
        and leave comments you can reply to. No login required, gated by this link.
      </p>

      {active && (
        <div className="mb-3 flex gap-4 text-xs">
          <span><strong className="font-bold">{fileCount}</strong> file{fileCount === 1 ? "" : "s"} from client</span>
          <span><strong className="font-bold">{messageCount}</strong> comment{messageCount === 1 ? "" : "s"}</span>
        </div>
      )}

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
              const newToken = await generateClientPortalLinkAction(clientId);
              setCurrentToken(newToken);
              setGenerating(false);
            });
          }}
          className="shrink-0 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {currentToken ? (copied ? "Copied ✓" : "Copy link") : generating ? "Generating…" : "Generate link"}
        </button>
      </div>

      {active && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <Link href={path!} target="_blank" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            Open client portal <ArrowRightIcon className="size-3" />
          </Link>
          <button
            type="button"
            onClick={() => {
              if (confirm("Revoke this portal link? The client will lose access immediately.")) {
                startTransition(() => revokeClientPortalLinkAction(clientId));
                setCurrentToken(null);
              }
            }}
            className="text-xs text-muted-foreground hover:text-[#d03b3b]"
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
