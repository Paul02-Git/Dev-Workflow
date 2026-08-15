import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/lib/queries/clients";
import { DeleteButton } from "@/components/delete-button";
import { deleteClientAction } from "@/lib/actions";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <Link href="/clients" className="text-xs font-medium text-[#2a78d6]">
          ← All clients
        </Link>
        {client.projects.length === 0 ? (
          <DeleteButton action={deleteClientAction.bind(null, client.id)} label="Delete client" />
        ) : (
          <span className="text-xs text-[#898781]">
            Delete this client's {client.projects.length} project(s) first to delete the client
          </span>
        )}
      </div>
      <h1 className="mt-2 mb-1 text-xl font-semibold">{client.name}</h1>
      {client.company && <p className="mb-4 text-sm text-[#52514e]">{client.company}</p>}

      <div className="mb-6 flex justify-end">
        <Link
          href={`/projects/new?clientId=${client.id}`}
          className="rounded-md bg-[#2a78d6] px-4 py-2 text-sm font-semibold text-white"
        >
          + New project for {client.name}
        </Link>
      </div>

      <h2 className="mb-2 text-sm font-semibold">Projects</h2>
      <div className="divide-y divide-black/10 rounded-xl border border-black/10 bg-[#fcfcfb]">
        {client.projects.length === 0 && (
          <div className="p-5 text-sm text-[#898781]">No projects yet.</div>
        )}
        {client.projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="flex items-center justify-between px-5 py-3 text-sm hover:bg-[#f9f9f7]"
          >
            <div>
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-[#898781]">{p.projectType}</div>
            </div>
            <div className="text-xs font-semibold text-[#52514e]">{p.healthScore}%</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
