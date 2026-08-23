import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

const PAGE_SIZES = [10, 25, 50];

function hrefWith(searchParamsString: string, updates: Record<string, string | null>): string {
  const params = new URLSearchParams(searchParamsString);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/projects?${qs}` : "/projects";
}

export function ProjectsPagination({
  page,
  pageSize,
  totalCount,
  searchParamsString,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  searchParamsString: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  // Small page list with a leading/trailing ellipsis once there are more
  // pages than fit comfortably — always keeps the first, last, and a
  // window around the current page visible.
  const pageNumbers: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pageNumbers.push(i);
    else if (pageNumbers[pageNumbers.length - 1] !== "…") pageNumbers.push("…");
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span>
          {start}-{end} of {totalCount}
        </span>
        <span>·</span>
        {PAGE_SIZES.map((size) => (
          <Link
            key={size}
            href={hrefWith(searchParamsString, { pageSize: String(size), page: null })}
            className={`rounded px-1.5 py-0.5 ${pageSize === size ? "bg-muted font-semibold text-foreground" : "hover:text-foreground"}`}
          >
            {size}
          </Link>
        ))}
        <span>per page</span>
      </div>

      <div className="flex items-center gap-1">
        <Link
          href={hrefWith(searchParamsString, { page: String(Math.max(1, page - 1)) })}
          aria-disabled={page <= 1}
          className={`flex items-center gap-1 rounded-md border border-border px-2 py-1 ${
            page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted"
          }`}
        >
          <ChevronLeftIcon className="size-3.5" /> Previous
        </Link>
        {pageNumbers.map((n, i) =>
          n === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1.5">
              …
            </span>
          ) : (
            <Link
              key={n}
              href={hrefWith(searchParamsString, { page: String(n) })}
              className={`flex h-7 w-7 items-center justify-center rounded-md ${
                n === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              {n}
            </Link>
          )
        )}
        <Link
          href={hrefWith(searchParamsString, { page: String(Math.min(totalPages, page + 1)) })}
          aria-disabled={page >= totalPages}
          className={`flex items-center gap-1 rounded-md border border-border px-2 py-1 ${
            page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-muted"
          }`}
        >
          Next <ChevronRightIcon className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
