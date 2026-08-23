"use client";

import { useState, useTransition } from "react";
import { MoreVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { deleteClientFromListAction, updateClientAction } from "@/lib/actions";

export function ClientRowActions({
  clientId,
  clientName,
  company,
  contactEmail,
  contactPhone,
  projectCount = 0,
}: {
  clientId: string;
  clientName: string;
  company?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  projectCount?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteClientFromListAction(clientId);
        setConfirmOpen(false);
      } catch (e) {
        // deleteClient() throws a real, readable message when the client
        // still has projects — surface that instead of letting it crash
        // into a generic error boundary.
        setError(e instanceof Error ? e.message : "Couldn't delete this client.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Client actions"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            />
          }
        >
          <MoreVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem
            onClick={() => {
              setError(null);
              setEditOpen(true);
            }}
          >
            <PencilIcon /> Edit client
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setError(null);
              setConfirmOpen(true);
            }}
          >
            <Trash2Icon /> Delete client
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Edit client</DialogTitle>
            <DialogDescription>Update {clientName}&apos;s contact details.</DialogDescription>
          </DialogHeader>
          <form
            action={async (formData) => {
              await updateClientAction(formData);
              setEditOpen(false);
            }}
            className="grid grid-cols-2 gap-3"
          >
            <input type="hidden" name="clientId" value={clientId} />
            <input
              name="name"
              defaultValue={clientName}
              placeholder="Client / contact name *"
              required
              className="col-span-2 rounded-md border border-black/15 px-3 py-2 text-sm sm:col-span-1"
            />
            <input
              name="company"
              defaultValue={company ?? ""}
              placeholder="Company"
              className="rounded-md border border-black/15 px-3 py-2 text-sm"
            />
            <input
              name="contactEmail"
              type="email"
              defaultValue={contactEmail ?? ""}
              placeholder="Email"
              className="rounded-md border border-black/15 px-3 py-2 text-sm"
            />
            <input
              name="contactPhone"
              defaultValue={contactPhone ?? ""}
              placeholder="Phone"
              className="rounded-md border border-black/15 px-3 py-2 text-sm"
            />
            <Button type="submit" className="col-span-2 mt-1 w-fit sm:col-span-1">
              Save changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete {clientName}?</DialogTitle>
            <DialogDescription>
              {projectCount > 0
                ? `Can't delete this client — it still has ${projectCount} project${projectCount === 1 ? "" : "s"}. Delete ${projectCount === 1 ? "it" : "those"} first.`
                : "This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-[#d03b3b]">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{projectCount > 0 ? "Close" : "Cancel"}</DialogClose>
            {projectCount === 0 && (
              <Button variant="destructive" disabled={pending} onClick={handleDelete}>
                {pending ? "Deleting…" : "Delete permanently"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
