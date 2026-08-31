"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVerticalIcon, ExternalLinkIcon, UsersIcon, Trash2Icon, StarIcon, StarOffIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
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
import { updateProjectStatusAction, deleteProjectFromListAction, toggleProjectPinnedAction } from "@/lib/actions";
import { STATUS_LABEL } from "@/lib/project-display";

const STATUSES = ["ACTIVE", "ON_HOLD", "LAUNCHED", "ARCHIVED"];

export function ProjectRowActions({
  projectId,
  projectName,
  currentStatus,
  clientId,
  isPinned,
}: {
  projectId: string;
  projectName: string;
  currentStatus: string;
  clientId?: string;
  isPinned?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      await deleteProjectFromListAction(projectId);
      setConfirmOpen(false);
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
              aria-label="Project actions"
              onClick={(e: React.MouseEvent) => {
                // Guards against being nested inside a <Link> card (the
                // grid view) as well as the table row's own click-to-navigate
                // handler — stopPropagation alone stops the JS router.push,
                // but a real <a> ancestor still needs preventDefault too.
                e.preventDefault();
                e.stopPropagation();
              }}
            />
          }
        >
          <MoreVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => router.push(`/projects/${projectId}`)}>
            <ExternalLinkIcon /> Open project
          </DropdownMenuItem>
          {clientId && (
            <DropdownMenuItem onClick={() => router.push(`/clients/${clientId}`)}>
              <UsersIcon /> View client
            </DropdownMenuItem>
          )}
          {isPinned !== undefined && (
            <DropdownMenuItem onClick={() => startTransition(() => toggleProjectPinnedAction(projectId, !isPinned))}>
              {isPinned ? (
                <>
                  <StarOffIcon /> Unpin project
                </>
              ) : (
                <>
                  <StarIcon /> Pin project
                </>
              )}
            </DropdownMenuItem>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Change status</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {STATUSES.filter((s) => s !== currentStatus).map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => startTransition(() => updateProjectStatusAction(projectId, s))}
                >
                  {STATUS_LABEL[s]?.label ?? s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2Icon /> Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete {projectName}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the project and every task, file, and access item under it. This can&apos;t
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" disabled={pending} onClick={handleDelete}>
              {pending ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
