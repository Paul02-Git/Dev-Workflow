"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLinkIcon, ArrowRightIcon } from "lucide-react";
import { generateHandoffLinkAction, revokeHandoffLinkAction } from "@/lib/actions";
import { relativeTime } from "@/lib/format-activity";

export function HandoffLinkPanel({
  projectId,
  token,
  lastViewedAt,
}: {
  projectId: string;
  token: string | null;
  lastViewedAt: Date | string | null;
}) {
  const [, startTransition] = useTransition();
  const [currentToken, setCurrentToken] = useState(token);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Only the relative path is ever rendered — identical on server and
  // client, so no hydration mismatch. The absolute URL (needs
  // window.location, which differs between SSR and the browser) is
  // computed only inside the click handler, after hydration.
  const path = currentToken ? `/handoff/${currentToken}` : null;
  const active = !!currentToken;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Client Portal / Handoff</h2>
        {active && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#0ca30c]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0ca30c]" />
            Active
          </span>
        )}
      </div>

      <div className="mb-3">
        <div className="text-[11px] text-muted-foreground">Client view last accessed</div>
        {!active ? (
          <div className="text-sm font-semibold text-[#c4c2bb]">—</div>
        ) : lastViewedAt ? (
          <Link
            href={path!}
            target="_blank"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            {relativeTime(lastViewedAt)} <ExternalLinkIcon className="size-3" />
          </Link>
        ) : (
          <div className="text-sm font-semibold text-muted-foreground">Not viewed yet</div>
        )}
      </div>

      <p className="mb-3 text-[11px] text-muted-foreground">
        Share a read-only view with your client so they can see project progress, completed work, and
        what&apos;s next. Never includes passwords.
      </p>

      {/* Same URL-pill + action-button layout regardless of state — the
          pill shows a placeholder and the button generates the link
          instead of copying it, rather than swapping to a whole separate
          empty-state layout. */}
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
              const newToken = await generateHandoffLinkAction(projectId);
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
          <Link
            href={path!}
            target="_blank"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Open client portal <ArrowRightIcon className="size-3" />
          </Link>
          <button
            type="button"
            onClick={() => {
              if (confirm("Revoke this handoff link? The current link will stop working immediately.")) {
                startTransition(() => revokeHandoffLinkAction(projectId));
                setCurrentToken(null);
              }
            }}
            className="text-xs text-muted-foreground hover:text-[#d03b3b]"
          >
            Revoke
          </button>
        </div>
      )}
    </div>
  );
}
