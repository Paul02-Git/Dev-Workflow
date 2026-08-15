import { listClients } from "@/lib/queries/clients";
import { createProjectAction } from "@/lib/actions";
import { TECHNOLOGIES } from "@/data/technologies";
import { PROJECT_TYPES } from "@/data/project-types";
import { ClientPicker } from "@/components/client-picker";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const clients = await listClients();

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold">New project</h1>
      <p className="mb-6 text-sm text-[#52514e]">
        Client → Project Type → Technologies → Generate Workflow. The workflow engine builds the
        stage/task list for you on submit.
      </p>

      <form action={createProjectAction} className="space-y-6 rounded-xl border border-black/10 bg-[#fcfcfb] p-6">
        <ClientPicker clients={clients} defaultClientId={clientId} />

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#52514e]">Project name *</label>
          <input
            name="name"
            required
            placeholder="e.g. Northgate Roofing — Website Redesign"
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#52514e]">Project type *</label>
          <select
            name="projectType"
            required
            defaultValue=""
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select a project type…
            </option>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold text-[#52514e]">Technologies</label>
          <div className="grid grid-cols-2 gap-2">
            {TECHNOLOGIES.map((tech) => (
              <label
                key={tech.key}
                className="flex items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm hover:bg-[#f9f9f7]"
              >
                <input type="checkbox" name="technologies" value={tech.key} className="accent-[#2a78d6]" />
                <span>
                  {tech.name}
                  <span className="ml-1 text-[11px] text-[#898781]">({tech.category})</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#898781]">
            Discovery, general QA/security, and Handoff tasks are always included regardless of what
            you select here.
          </p>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-[#2a78d6] py-2.5 text-sm font-semibold text-white"
        >
          Generate workflow →
        </button>
      </form>
    </div>
  );
}
