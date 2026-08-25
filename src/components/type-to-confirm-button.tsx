"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

/**
 * Shared modal + type-to-confirm pattern for admin-only actions where a
 * plain click (or the shared DeleteButton's inline click-to-confirm toggle
 * used elsewhere in the app) isn't enough friction — currently backs both
 * "Delete permanently" and "Restore" on /admin, since both act on another
 * organization's account state and neither should be a one-click accident.
 */
export function TypeToConfirmButton({
  id,
  action,
  triggerLabel,
  triggerClassName,
  dialogTitle,
  dialogDescription,
  confirmWord,
  confirmLabel,
  pendingLabel,
  confirmVariant = "destructive",
}: {
  id: string;
  action: (id: string) => Promise<void>;
  triggerLabel: string;
  triggerClassName?: string;
  dialogTitle: string;
  dialogDescription: React.ReactNode;
  confirmWord: string;
  confirmLabel: string;
  pendingLabel: string;
  confirmVariant?: "destructive" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  const canConfirm = confirmText.trim() === confirmWord;

  return (
    <>
      <Button type="button" variant="outline" size="sm" className={triggerClassName} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmText("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <Input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmWord}
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant={confirmVariant}
              disabled={!canConfirm || pending}
              onClick={() =>
                startTransition(async () => {
                  await action(id);
                  setOpen(false);
                  setConfirmText("");
                })
              }
            >
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
