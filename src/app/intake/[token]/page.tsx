import { notFound } from "next/navigation";
import { resolveIntakeToken } from "@/lib/queries/agency-settings";
import { submitIntakeAction } from "@/lib/actions";
import { TECHNOLOGIES } from "@/data/technologies";
import { PROJECT_TYPES } from "@/data/project-types";
import { SubmitButton } from "@/components/submit-button";

export default async function IntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveIntakeToken(token);
  if (!resolved) notFound();

  return (
    <div className="min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold">Let&apos;s get your details</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One quick form — {resolved.organizationName} will follow up to kick off your project.
          </p>
        </div>

        <form action={submitIntakeAction} className="space-y-6 rounded-xl border border-border bg-card p-6">
          <input type="hidden" name="token" value={token} />

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-[#52514e]">First &amp; last name *</label>
              <input name="name" required placeholder="Jordan Blake" className="w-full rounded-md border border-black/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#52514e]">Company (optional)</label>
              <input name="company" placeholder="Better Life PT" className="w-full rounded-md border border-black/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#52514e]">Email *</label>
              <input name="contactEmail" type="email" required placeholder="you@example.com" className="w-full rounded-md border border-black/15 px-3 py-2 text-sm" />
              <p className="mt-1 text-[11px] text-muted-foreground">We&apos;ll email you a link to access your workspace — no password to set.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#52514e]">Phone</label>
              <input name="contactPhone" type="tel" placeholder="(555) 012-3456" className="w-full rounded-md border border-black/15 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-[#52514e]">Address (optional)</label>
              <input name="address" placeholder="Street, City, State" className="w-full rounded-md border border-black/15 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="rounded-lg border border-black/15 p-4">
            <h2 className="text-sm font-semibold">What do you need help with? *</h2>
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#52514e]">Project name</label>
                <input name="projectName" placeholder="e.g. Website Redesign" className="w-full rounded-md border border-black/15 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#52514e]">Project type *</label>
                <select name="projectType" required defaultValue="" className="w-full rounded-md border border-black/15 px-3 py-2 text-sm">
                  <option value="" disabled>Select one…</option>
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold text-[#52514e]">Services *</label>
                <div className="grid grid-cols-2 gap-2">
                  {TECHNOLOGIES.map((tech) => (
                    <label key={tech.key} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
                      <input type="checkbox" name="technologies" value={tech.key} className="accent-primary" />
                      <span>{tech.name}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Select at least one.</p>
              </div>
            </div>
          </div>

          <SubmitButton pendingLabel="Creating…" className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
            Create my account
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
