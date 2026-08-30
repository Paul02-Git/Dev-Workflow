"use client";

import { useState, useTransition } from "react";
import { UserPlusIcon } from "lucide-react";
import { generateIntakeLinkAction, revokeIntakeLinkAction } from "@/lib/actions";

export function IntakeLinkPanel({ token }: { token: string | null }) {
  const [, startTransition] = useTransition();
  const [currentToken, setCurrentToken] = useState(token);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const path = currentToken ? `/intake/${currentToken}` : null;

  return (
    <div className="app-card flex flex-wrap items-center justify-between gap-3 p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#eafaea] text-[#0ca30c]">
          <UserPlusIcon className="size-4" />
        </span>
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">New Client Intake</div>
          <div className="text-xs text-muted-foreground">
            One link — share it broadly. Filling it out creates the client for you automatically.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <code className="truncate rounded-md border border-black/15 bg-white px-2.5 py-1.5 text-xs">
          {path ?? "Not generated yet"}
        </code>
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
          className="shrink-0 rounded-md bg-[#111827] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#111827]/90 disabled:opacity-50"
        >
          {currentToken ? (copied ? "Copied ✓" : "Copy link") : generating ? "Generating…" : "Generate link"}
        </button>
        {currentToken && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Revoke the intake link? It'll stop working immediately.")) {
                startTransition(() => revokeIntakeLinkAction());
                setCurrentToken(null);
              }
            }}
            className="text-xs text-muted-foreground hover:text-[#d03b3b]"
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}
