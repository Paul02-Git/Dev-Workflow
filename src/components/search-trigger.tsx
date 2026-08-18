"use client";

export function SearchTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("command-palette:open"))}
      className="mb-3 flex w-full items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-xs text-muted-foreground hover:border-black/20"
    >
      <span>Search…</span>
      <span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</span>
    </button>
  );
}
