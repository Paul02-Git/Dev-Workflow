"use client";

import { useState } from "react";
import { StarIcon } from "lucide-react";
import { toggleProjectPinnedAction } from "@/lib/actions";

/** Star toggle for pinning a project — sits inside a card/row that's itself a link, so clicks must not bubble into it. */
export function PinProjectButton({ projectId, pinned }: { projectId: string; pinned: boolean }) {
  const [localPinned, setLocalPinned] = useState(pinned);

  // Same "adjust state during render" pattern as TaskDoneCheckbox — picks
  // up the real value once revalidation lands, without a useEffect.
  const [prevPinned, setPrevPinned] = useState(pinned);
  if (pinned !== prevPinned) {
    setPrevPinned(pinned);
    setLocalPinned(pinned);
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !localPinned;
        setLocalPinned(next);
        toggleProjectPinnedAction(projectId, next);
      }}
      aria-label={localPinned ? "Unpin project" : "Pin project"}
      title={localPinned ? "Unpin project" : "Pin project"}
      className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition hover:bg-muted hover:text-muted-foreground"
    >
      <StarIcon className={`size-4 ${localPinned ? "fill-[#f5a623] text-[#f5a623]" : ""}`} />
    </button>
  );
}
