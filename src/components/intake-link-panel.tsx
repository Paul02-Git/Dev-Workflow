"use client";

import { useState, useTransition } from "react";
import { UserPlusIcon, XIcon } from "lucide-react";
import { generateIntakeLinkAction, revokeIntakeLinkAction } from "@/lib/actions";

// Deliberately compact - one always-visible control in the header rather
// than a full-width card, since a client intake link is set up once and
// then mostly just needs to stay reachable, not take up a whole row.
export function IntakeLinkPanel({ token }: { token: string | null }) {
  const [, startTransition] = useTransition();
  const [currentToken, setCurrentToken] = useState(token);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const path = currentToken ? `/intake/${currentToken}` : null;

  return (
    <div className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-input bg-card px-2.5 text-xs">
      <UserPlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${currentToken ? "bg-[#0ca30c]" : "bg-muted-foreground/40"}`}
        title={currentToken ? "Intake link is live" : "Intake link not generated yet"}
      />
      <button
        type="button"
        disabled={generating}
        onClick={async () => {
          if (currentToken) {
            await navigator.clipboard.writeText(`${window.location.origin}${path}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
            return;
          }
          setGenerating(true);
          startTransition(async () => {
            const newToken = await generateIntakeLinkAction();
            setCurrentToken(newToken);
            setGenerating(false);
          });
        }}
        className="whitespace-nowrap font-medium text-foreground hover:text-link disabled:opacity-50"
      >
        {currentToken ? (copied ? "Copied!" : "Copy intake link") : generating ? "Generating..." : "Generate intake link"}
      </button>
      {currentToken && (
        <button
          type="button"
          onClick={() => {
            if (confirm("Revoke the intake link? It will stop working immediately.")) {
              startTransition(() => revokeIntakeLinkAction());
              setCurrentToken(null);
            }
          }}
          aria-label="Revoke intake link"
          title="Revoke intake link"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-[#d03b3b]"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}
