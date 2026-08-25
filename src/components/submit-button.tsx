"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/spinner";

/**
 * Shared submit button for every form action in this app that redirects
 * or does real write work on submit (signup, intake, project creation…).
 * `disabled={pending}` — driven by useFormStatus, which tracks the
 * nearest parent <form>'s Server Action — is what actually stops a
 * double-click/spam-click from firing the action twice; the spinner +
 * label swap is just the visible feedback for that same pending state.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Spinner className="size-4" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
