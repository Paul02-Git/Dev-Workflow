"use client";

import { useState, useTransition } from "react";
import {
  setAccessItemCredentialsAction,
  clearAccessItemCredentialsAction,
  revealAccessItemPasswordAction,
} from "@/lib/actions";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type AccessItem = {
  id: string;
  name: string;
  url: string | null;
  role: string | null;
  instructions: string | null;
  grantedAt: Date | string | null;
  username: string | null;
  status: string;
  hasPassword: boolean;
};

/**
 * Re-exposes the AES-256-GCM encrypted vault (see queries/access-items.ts)
 * as a fully controlled shadcn Dialog — no trigger of its own, so callers
 * (the Accounts & Access row's "⋮" menu) decide how it's opened.
 */
export function CredentialsDialog({
  projectId,
  item,
  open,
  onOpenChange,
}: {
  projectId: string;
  item: AccessItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [revealing, startReveal] = useTransition();
  const [clearing, startClear] = useTransition();

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) setRevealed(null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Login details — {item.name}</DialogTitle>
          <DialogDescription>
            Stored encrypted (AES-256-GCM). Only decrypted when you click Reveal.
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (formData) => {
            await setAccessItemCredentialsAction(formData);
            handleOpenChange(false);
          }}
          className="space-y-3"
        >
          <input type="hidden" name="accessItemId" value={item.id} />
          <input type="hidden" name="projectId" value={projectId} />

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Username / email</label>
            <input
              type="text"
              name="username"
              autoComplete="off"
              defaultValue={item.username ?? ""}
              placeholder="Username or email"
              className="w-full rounded border border-black/15 px-2 py-1.5 text-sm"
            />
          </div>

          {item.hasPassword && (
            <div className="flex items-center gap-2 rounded border border-border bg-muted px-2 py-1.5 text-sm">
              <span className="flex-1 font-mono">
                {revealing ? "Decrypting…" : (revealed ?? "••••••••••••")}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (revealed) {
                    setRevealed(null);
                    return;
                  }
                  startReveal(async () => {
                    const password = await revealAccessItemPasswordAction(item.id);
                    setRevealed(password ?? "(none)");
                  });
                }}
                title={revealed ? "Hide" : "Reveal current password"}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                {revealed ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
              </button>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {item.hasPassword ? "New password" : "Password"}
            </label>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder={item.hasPassword ? "Leave blank to keep current password" : "Password"}
              className="w-full rounded border border-black/15 px-2 py-1.5 text-sm"
            />
          </div>

          <DialogFooter className="items-center sm:justify-between">
            {(item.hasPassword || item.username) ? (
              <button
                type="button"
                disabled={clearing}
                onClick={() => {
                  if (confirm(`Clear stored login details for ${item.name}?`)) {
                    startClear(async () => {
                      await clearAccessItemCredentialsAction(item.id, projectId);
                      handleOpenChange(false);
                    });
                  }
                }}
                className="text-xs font-medium text-[#d03b3b] hover:underline disabled:opacity-50"
              >
                {clearing ? "Clearing…" : "Clear credentials"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <DialogClose render={<Button type="button" variant="outline" size="sm" />}>Cancel</DialogClose>
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
