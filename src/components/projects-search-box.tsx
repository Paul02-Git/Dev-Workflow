"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SearchIcon } from "lucide-react";

export function ProjectsSearchBox({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  // Debounced push to the `q` param, same 150ms window the command palette
  // uses for live search — short enough to feel instant, long enough that
  // fast typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query.trim()) params.set("q", query.trim());
      else params.delete("q");
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 150);
    return () => clearTimeout(timer);
    // Only re-fire on query changes — pathname/searchParams/router are read
    // fresh from the closure each time, not deps to re-run the debounce on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search projects"
        className="h-8 w-56 rounded-lg border border-input bg-card pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}
