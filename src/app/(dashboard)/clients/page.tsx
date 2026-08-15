import Link from "next/link";
import { listClients } from "@/lib/queries/clients";
import { createClientAction } from "@/lib/actions";

export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-xl font-semibold">Clients</h1>
      <p className="mb-6 text-sm text-[#52514e]">{clients.length} client(s)</p>

      <div className="mb-8 rounded-xl border border-black/10 bg-[#fcfcfb] p-5">
        <h2 className="mb-3 text-sm font-semibold">Add a client</h2>
        <form action={createClientAction} className="grid grid-cols-2 gap-3">
          <input
            name="name"
            placeholder="Client / contact name *"
            required
            className="col-span-2 rounded-md border border-black/15 px-3 py-2 text-sm sm:col-span-1"
          />
          <input
            name="company"
            placeholder="Company"
            className="rounded-md border border-black/15 px-3 py-2 text-sm"
          />
          <input
            name="contactEmail"
            placeholder="Email"
            className="rounded-md border border-black/15 px-3 py-2 text-sm"
          />
          <input
            name="contactPhone"
            placeholder="Phone"
            className="rounded-md border border-black/15 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="col-span-2 mt-1 w-fit rounded-md bg-[#2a78d6] px-4 py-2 text-sm font-semibold text-white sm:col-span-1"
          >
            Add client
          </button>
        </form>
      </div>

      <div className="divide-y divide-black/10 rounded-xl border border-black/10 bg-[#fcfcfb]">
        {clients.length === 0 && (
          <div className="p-5 text-sm text-[#898781]">No clients yet — add one above.</div>
        )}
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/clients/${c.id}`}
            className="flex items-center justify-between px-5 py-3 text-sm hover:bg-[#f9f9f7]"
          >
            <div>
              <div className="font-medium">{c.name}</div>
              {c.company && <div className="text-xs text-[#898781]">{c.company}</div>}
            </div>
            <div className="text-xs text-[#898781]">{c.contactEmail}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
