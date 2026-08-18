import { STAGES } from "@/data/stages";
import { TECHNOLOGIES } from "@/data/technologies";
import { ALL_TEMPLATES } from "@/data/templates";

export default function SettingsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold">Settings</h1>
      <p className="mb-6 text-sm text-[#52514e]">
        Single-user mode — there&apos;s no account/auth system yet, so nothing here is per-user configuration.
        This page is a reference view of the workflow engine&apos;s current configuration.
      </p>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold text-[#52514e]">Stages</div>
          <div className="text-2xl font-bold">{STAGES.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold text-[#52514e]">Technologies</div>
          <div className="text-2xl font-bold">{TECHNOLOGIES.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold text-[#52514e]">Templates</div>
          <div className="text-2xl font-bold">{ALL_TEMPLATES.length}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-2 text-sm font-semibold">Not configurable yet</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-[#52514e]">
          <li>Authentication / multi-user access control</li>
          <li>Email or notification preferences</li>
          <li>Editing templates, stages, or technologies from the UI (edit the files in{" "}
            <code className="rounded bg-black/5 px-1 py-0.5 text-[11px]">src/data/</code> and{" "}
            <code className="rounded bg-black/5 px-1 py-0.5 text-[11px]">src/data/templates/</code> instead)
          </li>
        </ul>
      </div>
    </div>
  );
}
