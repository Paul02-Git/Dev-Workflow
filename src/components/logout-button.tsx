"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

/**
 * Shared logout confirmation — used by both the internal agency sidebar
 * (logoutAction) and the public Client Workspace sidebar
 * (clientLogoutAction), so an accidental click on "Log out"/"Sign out"
 * doesn't immediately end the session with no way back. Lighter than
 * TypeToConfirmButton (no type-to-confirm) — logging out isn't
 * destructive or irreversible the way deleting an organization is, it
 * just deserves one deliberate click instead of zero.
 */
export function LogoutButton({
  action,
  triggerLabel,
  triggerClassName,
  dialogTitle = "Log out?",
  dialogDescription = "You'll need to sign in again to get back in.",
}: {
  action: () => Promise<void>;
  triggerLabel: string;
  triggerClassName?: string;
  dialogTitle?: string;
  dialogDescription?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" disabled={pending} onClick={() => startTransition(action)}>
              {pending ? "Logging out…" : triggerLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
