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

export function ClientSettingsTab({ loginSlug, client }: { loginSlug: string | null; client: ClientInfo }) {
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold">Profile</h2>
        <form
          action={async (formData) => {
            setSaved(false);
            await updateClientPortalInfoAction(formData);
            setSaved(true);
          }}
          className="grid grid-cols-2 gap-3"
        >
          <label className="col-span-2 text-xs font-semibold text-muted-foreground sm:col-span-1">
            Name
            <input name="name" defaultValue={client.name} required className="mt-1 w-full rounded-md border border-black/15 px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Company
            <input name="company" defaultValue={client.company ?? ""} className="mt-1 w-full rounded-md border border-black/15 px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Email
            <input name="contactEmail" type="email" defaultValue={client.contactEmail ?? ""} className="mt-1 w-full rounded-md border border-black/15 px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Phone
            <input name="contactPhone" type="tel" defaultValue={client.contactPhone ?? ""} className="mt-1 w-full rounded-md border border-black/15 px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="col-span-2 text-xs font-semibold text-muted-foreground">
            Address (optional)
            <input name="address" defaultValue={client.address ?? ""} className="mt-1 w-full rounded-md border border-black/15 px-3 py-2 text-sm text-foreground" />
          </label>
          <div className="col-span-2 mt-1 flex items-center gap-3">
            <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
              Save changes
            </button>
            {saved && <span className="text-xs font-medium text-[#0ca30c]">Saved.</span>}
          </div>
        </form>
      </section>

      {loginSlug && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold">Account</h2>
          <p className="text-sm">
            You log in as <strong className="font-bold">{loginSlug}</strong>. Ask Paul for a password reset link if you forget it.
          </p>
        </section>
      )}
    </div>
  );
}
