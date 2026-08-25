"use client";

import { useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { deleteOrganizationAction } from "@/lib/actions";

export function OrganizationRowActions({
  orgId,
  orgName,
  clientCount,
  projectCount,
}: {
  orgId: string;
  orgName: string;
  clientCount: number;
  projectCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete organization"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirmOpen(true);
        }}
      >
        <Trash2Icon className="size-4" />
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete {orgName}?</DialogTitle>
            <DialogDescription>
              {clientCount} client{clientCount === 1 ? "" : "s"}, {projectCount} project{projectCount === 1 ? "" : "s"}. This blocks
              their login immediately. Restorable from the Deleted section for 30 days, then it can be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => startTransition(async () => {
                await deleteOrganizationAction(orgId);
                setConfirmOpen(false);
              })}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
