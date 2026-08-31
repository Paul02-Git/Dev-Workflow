"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailIcon, PhoneIcon, CopyIcon, CheckIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ClientRowActions } from "@/components/client-row-actions";
import { hashPick } from "@/lib/hash-color";
import { PROJECT_COLOR_PALETTE } from "@/lib/project-display";
import { deleteClientFromListAction } from "@/lib/actions";
import type { ClientCardData } from "@/components/client-card";

function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(email);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1 text-xs font-medium text-link hover:underline"
      aria-label="Copy email"
    >
      {copied ? <CheckIcon className="size-3 text-[#0ca30c]" /> : <CopyIcon className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
export function ClientsTable({ clients }: { clients: ClientCardData[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const allSelected = clients.length > 0 && selected.size === clients.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(clients.map((c) => c.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedClients = useMemo(() => clients.filter((c) => selected.has(c.id)), [clients, selected]);
  const deletable = selectedClients.filter((c) => c.projectCount === 0);
  const blockedCount = selectedClients.length - deletable.length;

  function confirmBulkDelete() {
    const ids = deletable.map((c) => c.id);
    startTransition(async () => {
      await Promise.all(ids.map((id) => deleteClientFromListAction(id)));
      setSelected(new Set());
      setBulkDeleteOpen(false);
    });
  }
  return (
    <div className="app-card overflow-hidden">
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-[#eef2fb] px-4 py-2.5">
          <span className="text-xs font-semibold text-[#2a4d8f]">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" disabled={pending} onClick={() => setBulkDeleteOpen(true)}>
              <Trash2Icon /> Delete
            </Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-muted-foreground hover:underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  className="size-3.5 rounded border-border accent-primary"
                  aria-label="Select all clients"
                />
              </th>
              <th className="px-2 py-2.5">Client Name</th>
              <th className="px-2 py-2.5">Contact</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="px-2 py-2.5">Source</th>
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => {
              const avatarColor = hashPick(c.name, PROJECT_COLOR_PALETTE);
              const showCompany = c.company && c.company.trim().toLowerCase() !== c.name.trim().toLowerCase();

              return (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/clients/${c.id}`)}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted"
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                      className="size-3.5 rounded border-border accent-primary"
                      aria-label={`Select ${c.name}`}
                    />
                  </td>
                  <td className="max-w-[240px] px-2 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {c.name.trim().charAt(0).toUpperCase() || "?"}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{c.name}</div>
                        {showCompany && <div className="truncate text-xs text-muted-foreground">{c.company}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-col gap-0.5">
                      {c.contactEmail ? (
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1.5 truncate text-xs text-foreground">
                            <MailIcon className="size-3 shrink-0 text-muted-foreground" />
                            {c.contactEmail}
                          </span>
                          <CopyEmailButton email={c.contactEmail} />
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">No email on file</span>
                      )}
                      {c.contactPhone ? (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <PhoneIcon className="size-3 shrink-0" />
                          {c.contactPhone}
                        </span>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">No phone on file</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-bold ${c.statusClassName}`}>
                      {c.statusLabel}
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <span className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {c.sourceLabel}
                    </span>
                  </td>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <ClientRowActions
                      clientId={c.id}
                      clientName={c.name}
                      company={c.company}
                      contactEmail={c.contactEmail}
                      contactPhone={c.contactPhone}
                      projectCount={c.projectCount}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deletable.length} client{deletable.length === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              {deletable.length > 0 && (
                <span>
                  This permanently deletes {deletable.map((c) => c.name).join(", ")}. This cannot be undone.
                </span>
              )}
              {blockedCount > 0 && (
                <span>
                  {" "}
                  {blockedCount} of the selected client{blockedCount === 1 ? "" : "s"} still{" "}
                  {blockedCount === 1 ? "has" : "have"} projects and will not be deleted. Remove those projects
                  first.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            {deletable.length > 0 && (
              <Button variant="destructive" disabled={pending} onClick={confirmBulkDelete}>
                {pending ? "Deleting..." : "Delete permanently"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
