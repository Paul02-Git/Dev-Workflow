"use client";

import { useState, useTransition } from "react";
import { createAccessItemAction, quickAddAccessItemAction, updateAccessItemStatusAction, deleteAccessItemAction } from "@/lib/actions";
import { PlatformIcon, resolvePlatformIcon, resolvePlatformLoginUrl } from "@/components/platform-icon";
import { ALL_ACCESS_ITEM_PRESETS } from "@/data/access-item-presets";
import { Trash2Icon } from "lucide-react";
import { hashPick } from "@/lib/hash-color";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_LABELS: Record<string, string> = {
  NOT_REQUESTED: "Not requested",
  REQUESTED: "Requested",
  INVITED: "Invited",
  GRANTED: "Access granted",
  VERIFIED: "Access verified",
  NOT_NEEDED: "Not needed",
};
const STATUS_COLORS: Record<string, string> = {
  NOT_REQUESTED: "#898781",
  REQUESTED: "#c9720a",
  INVITED: "#c9720a",
  GRANTED: "#0ca30c",
  VERIFIED: "#0ca30c",
  NOT_NEEDED: "#898781",
};
const STATUS_BG: Record<string, string> = {
  NOT_REQUESTED: "#f1f0ee",
  REQUESTED: "#fef4de",
  INVITED: "#fef4de",
  GRANTED: "#eafaea",
  VERIFIED: "#eafaea",
  NOT_NEEDED: "#f1f0ee",
};

// Colored monogram fallback for platforms without a real brand icon in
// platform-icon.tsx (Klaviyo, Printify, GoHighLevel, Microsoft Clarity, or
// any custom name — access items are free-text, not an enum).
const FALLBACK_PALETTE = ["#2a78d6", "#0ca30c", "#c9720a", "#a259ff", "#d03b3b", "#0b8f8f"];
function monogramColor(name: string): string {
  return hashPick(name, FALLBACK_PALETTE);
}

type AccessItem = {
  id: string;
  name: string;
  url: string | null;
  role: string | null;
  instructions: string | null;
  grantedAt: Date | string | null;
  username: string | null;
  status: string;
  hasPassword: boolean;
};

export function AccessItemsPanel({ projectId, items }: { projectId: string; items: AccessItem[] }) {
  const [, startTransition] = useTransition();
  const [addMode, setAddMode] = useState<"closed" | "picker" | "custom">("closed");
  const [showAddLogin, setShowAddLogin] = useState(false);
  const [addingPreset, setAddingPreset] = useState<string | null>(null);

  const existingNames = new Set(items.map((i) => i.name.trim().toLowerCase()));
  const availablePresets = ALL_ACCESS_ITEM_PRESETS.filter((p) => !existingNames.has(p.name.trim().toLowerCase()));

  return (
    <div className="h-full rounded-lg border border-border bg-card p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Accounts & Access</h2>
        <button
          type="button"
          onClick={() => setAddMode(addMode === "closed" ? "picker" : "closed")}
          className="shrink-0 rounded-md border border-black/15 bg-white px-2.5 py-1 text-xs font-semibold text-primary hover:bg-muted"
        >
          + Add platform
        </button>
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">
        Track whether you&apos;ve been invited in yet — not a password vault.
      </p>

      {addMode === "picker" && (
        <div className="mb-3 rounded-md border border-black/15 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#52514e]">Pick a platform — added instantly, no typing.</span>
            <button type="button" onClick={() => setAddMode("closed")} className="text-xs text-muted-foreground hover:underline">
              Cancel
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {availablePresets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                disabled={addingPreset !== null}
                onClick={() => {
                  setAddingPreset(preset.name);
                  startTransition(async () => {
                    await quickAddAccessItemAction(projectId, preset.name);
                    setAddingPreset(null);
                    setAddMode("closed");
                  });
                }}
                className="flex items-center gap-1.5 rounded-full border border-black/15 bg-white py-1.5 pr-3 pl-1.5 text-xs font-medium text-foreground hover:border-primary hover:bg-muted disabled:opacity-50"
              >
                {resolvePlatformIcon(preset.name) ? (
                  <PlatformIcon name={preset.name} size={20} />
                ) : (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ backgroundColor: monogramColor(preset.name) }}
                  >
                    {preset.name.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                {addingPreset === preset.name ? "Adding…" : preset.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAddMode("custom")}
              className="rounded-full border border-dashed border-black/20 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
            >
              + Custom platform…
            </button>
          </div>
        </div>
      )}

      {addMode === "custom" && (
        <form
          action={async (formData) => {
            await createAccessItemAction(formData);
            setAddMode("closed");
            setShowAddLogin(false);
          }}
          className="mb-3 space-y-2 rounded-md border border-black/15 bg-white p-3"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              name="name"
              required
              autoFocus
              placeholder="e.g. Klaviyo"
              className="rounded border border-black/15 px-2 py-1 text-sm"
            />
            <input
              type="url"
              name="url"
              placeholder="https://... (optional)"
              className="min-w-[180px] flex-1 rounded border border-black/15 px-2 py-1 text-sm"
            />
            <input
              type="text"
              name="role"
              placeholder="Role to request (optional)"
              className="w-40 rounded border border-black/15 px-2 py-1 text-sm"
            />
          </div>
          <textarea
            name="instructions"
            placeholder="What to ask the client for (optional)"
            rows={2}
            className="w-full rounded border border-black/15 px-2 py-1 text-sm"
          />

          {!showAddLogin ? (
            <button
              type="button"
              onClick={() => setShowAddLogin(true)}
              className="block text-[11px] text-muted-foreground hover:underline"
            >
              Shared login instead?
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted p-2">
              <input
                type="text"
                name="username"
                autoComplete="off"
                placeholder="Username/email"
                className="rounded border border-black/15 px-2 py-1 text-sm"
              />
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="Password (encrypted)"
                className="rounded border border-black/15 px-2 py-1 text-sm"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMode("closed");
                setShowAddLogin(false);
              }}
              className="text-xs text-muted-foreground hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div>
        {items.length === 0 && (
          <div className="py-3 text-sm text-muted-foreground">No platforms tracked yet.</div>
        )}
        {items.map((item) => (
          <AccessItemRow key={item.id} projectId={projectId} item={item} />
        ))}
      </div>
    </div>
  );
}

function AccessItemRow({ projectId, item }: { projectId: string; item: AccessItem }) {
  const [, startTransition] = useTransition();
  const hasBrandIcon = !!resolvePlatformIcon(item.name);
  // Prefer the project-specific URL if one's been entered; otherwise fall
  // back to the platform's generic login page so "Open" isn't a dead end
  // just because nobody's typed a URL in yet.
  const openUrl = item.url || resolvePlatformLoginUrl(item.name);

  return (
    <div className="py-2">
      <div className="flex items-center gap-3">
        {hasBrandIcon ? (
          <PlatformIcon name={item.name} size={28} />
        ) : (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
            style={{ backgroundColor: monogramColor(item.name) }}
            aria-hidden="true"
          >
            {item.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        )}

        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.name}</span>

        <Select
          value={item.status}
          items={STATUS_LABELS}
          onValueChange={(value) => startTransition(() => updateAccessItemStatusAction(item.id, projectId, value as string))}
        >
          {/* Fixed width so the pill's footprint never changes when the
              selected label's length changes — Open/delete stay put
              instead of shifting, same fixed-size idea used for the
              checklist card's list budget. Extra right padding keeps the
              chevron off the pill's edge. */}
          <SelectTrigger
            className="h-7 w-36 shrink-0 justify-between rounded-lg border-0 pr-3 pl-2.5 text-[11px] font-semibold"
            style={{ backgroundColor: STATUS_BG[item.status], color: STATUS_COLORS[item.status] }}
          >
            <SelectValue />
          </SelectTrigger>
          {/* alignItemWithTrigger=false: a plain dropdown anchored below the
              trigger, not base-ui's default of centering the popup on the
              currently-selected item (which visually overlapped the pill). */}
          <SelectContent align="end" alignItemWithTrigger={false}>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {openUrl ? (
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={item.url ? undefined : "No project-specific URL saved — opening the platform's login page"}
            className="shrink-0 rounded-md border border-black/15 bg-white px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted"
          >
            Open
          </a>
        ) : (
          <span
            title="No URL saved and no known login page for this platform"
            className="shrink-0 rounded-md border border-border px-3 py-1 text-xs font-semibold text-[#c4c2bb]"
          >
            Open
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove ${item.name} from this project's accounts?`)) {
              startTransition(() => deleteAccessItemAction(item.id));
            }
          }}
          aria-label={`Remove ${item.name}`}
          title="Remove platform"
          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-[#fbe6e6] hover:text-[#d03b3b]"
        >
          <Trash2Icon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
