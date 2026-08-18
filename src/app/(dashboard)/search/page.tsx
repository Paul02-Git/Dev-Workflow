import Link from "next/link";
import { searchAll } from "@/lib/queries/search";

const TYPE_LABELS: Record<string, string> = {
  client: "Client",
  project: "Project",
  task: "Task",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q ?? "";
  const results = query ? await searchAll(query) : [];

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-xl font-semibold">Search</h1>
      <form action="/search" className="mb-6">
        <input
          type="text"
          name="q"
          defaultValue={query}
          autoFocus
          placeholder="Search clients, projects, tasks…"
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm"
        />
      </form>

      {!query && <p className="text-sm text-muted-foreground">Type a name, domain, or task title above.</p>}
      {query && results.length === 0 && (
        <p className="text-sm text-muted-foreground">No matches for &ldquo;{query}&rdquo;.</p>
      )}

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {results.map((r) => (
          <Link
            key={`${r.type}-${r.id}`}
            href={r.href}
            className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-muted"
          >
            <div className="min-w-0">
              <div className="font-medium">{r.title}</div>
              <div className="text-xs text-muted-foreground">{r.subtitle}</div>
            </div>
            <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-[#52514e]">
              {TYPE_LABELS[r.type] ?? r.type}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
