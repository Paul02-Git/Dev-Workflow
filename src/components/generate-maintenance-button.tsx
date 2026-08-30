"use client";

import { useState, useTransition } from "react";
import { generateMaintenanceRunAction } from "@/lib/actions";

export function GenerateMaintenanceButton({ planId }: { planId: string }) {
  const [, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) {
    return <span className="shrink-0 text-xs font-semibold text-[#0ca30c]">Generated ✓</span>;
  }

  return (
    <button
      type="button"
      onClick={() => startTransition(async () => {
        await generateMaintenanceRunAction(planId);
        setDone(true);
      })}
      className="shrink-0 rounded-md bg-[#262626] px-2.5 py-1 text-xs font-semibold text-white"
    >
      Generate checklist
    </button>
  );
}
