"use client";

import { useState, useTransition } from "react";

export function DeleteButton({ action, label = "Delete" }: { action: () => Promise<void>; label?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-semibold text-[#d03b3b] hover:bg-[#fdf5f5]"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-[#d03b3b]">Delete permanently?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(action)}
        className="rounded-md bg-[#d03b3b] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-xs text-[#898781] hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}
