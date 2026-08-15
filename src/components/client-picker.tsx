"use client";

import { useState } from "react";

const NEW_CLIENT_VALUE = "__new__";

export function ClientPicker({
  clients,
  defaultClientId,
}: {
  clients: { id: string; name: string }[];
  defaultClientId?: string;
}) {
  const [value, setValue] = useState(defaultClientId ?? "");
  const isNew = value === NEW_CLIENT_VALUE;

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#52514e]">Client *</label>
      <select
        name="clientId"
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          Select a client…
        </option>
        <option value={NEW_CLIENT_VALUE}>+ Add new client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {clients.length === 0 && !isNew && (
        <p className="mt-1 text-xs text-[#898781]">No clients yet — pick &ldquo;+ Add new client&rdquo; above.</p>
      )}

      {isNew && (
        <div className="mt-3 space-y-3 rounded-md border border-black/10 bg-white p-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#52514e]">New client name *</label>
            <input
              name="newClientName"
              required
              placeholder="e.g. Northgate Roofing"
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#52514e]">Company</label>
            <input
              name="newClientCompany"
              placeholder="Optional"
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#52514e]">Contact email</label>
            <input
              name="newClientEmail"
              type="email"
              placeholder="Optional"
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
