"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { ClientCard, type ClientCardData } from "@/components/client-card";

/**
 * Tabs (All/New) are still real navigation — switching them re-fetches a
 * genuinely different server-computed dataset. Search is different: it
 * only ever narrows whatever's already on the page, so it's plain client
 * state filtering in memory as you type — no round trip, no need to press
 * Enter, which is the whole point of a live search box.
 */
export function ClientsSection({
  cards,
  activeFilter,
  allCount,
  newCount,
}: {
  cards: ClientCardData[];
  activeFilter: "all" | "new";
  allCount: number;
  newCount: number;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.contactEmail ?? "").toLowerCase().includes(q)
    );
  }, [cards, query]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Link
            href="/clients"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              activeFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-black/10"
            }`}
          >
            All Clients <span className="opacity-80">{allCount}</span>
          </Link>
          <Link
            href="/clients?filter=new"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              activeFilter === "new" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-black/10"
            }`}
          >
            New <span className="opacity-80">{newCount}</span>
          </Link>
        </div>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients…"
            className="w-56 rounded-md border border-black/15 bg-white py-1.5 pl-8 pr-3 text-sm"
          />
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="app-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No clients match this filter.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="app-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No clients match &quot;{query}&quot;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  );
}
