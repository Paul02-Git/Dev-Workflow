"use client";

import { useState } from "react";
import { updateClientPortalInfoAction } from "@/lib/actions";

type ClientInfo = {
  name: string;
  company: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
};

export function ClientInfoModal({ token, client }: { token: string; client: ClientInfo }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Edit your info"
        title="Edit your info"
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
      >
        ⚙
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold">Your info</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted">
                ✕
              </button>
            </div>
            <form
              action={async (formData) => {
                await updateClientPortalInfoAction(formData);
                setOpen(false);
              }}
              className="grid grid-cols-2 gap-3"
            >
              <input type="hidden" name="token" value={token} />
              <input name="name" defaultValue={client.name} required placeholder="First & last name" className="col-span-2 rounded-md border border-black/15 px-3 py-2 text-sm sm:col-span-1" />
              <input name="company" defaultValue={client.company ?? ""} placeholder="Company" className="rounded-md border border-black/15 px-3 py-2 text-sm" />
              <input name="contactEmail" type="email" defaultValue={client.contactEmail ?? ""} placeholder="Email" className="rounded-md border border-black/15 px-3 py-2 text-sm" />
              <input name="contactPhone" type="tel" defaultValue={client.contactPhone ?? ""} placeholder="Phone" className="rounded-md border border-black/15 px-3 py-2 text-sm" />
              <input name="address" defaultValue={client.address ?? ""} placeholder="Address (optional)" className="col-span-2 rounded-md border border-black/15 px-3 py-2 text-sm" />
              <div className="col-span-2 mt-1 flex gap-2">
                <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                  Save changes
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
