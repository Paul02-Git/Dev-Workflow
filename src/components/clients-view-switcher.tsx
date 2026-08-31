import Link from "next/link";
import { ListIcon, LayoutGridIcon } from "lucide-react";

const VIEWS: { value: string; label: string; icon: typeof ListIcon }[] = [
  { value: "list", label: "List", icon: ListIcon },
  { value: "cards", label: "Cards", icon: LayoutGridIcon },
];

/** Preserves every other query param when switching views - only `view` (and the now-irrelevant `page`) changes. */
function hrefFor(view: string, currentParams: URLSearchParams): string {
  const params = new URLSearchParams(currentParams.toString());
  if (view === "list") params.delete("view");
  else params.set("view", view);
  params.delete("page");
  const qs = params.toString();
  return qs ? `/clients?${qs}` : "/clients";
}

export function ClientsViewSwitcher({ active, searchParamsString }: { active: string; searchParamsString: string }) {
  const currentParams = new URLSearchParams(searchParamsString);

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted p-1">
      {VIEWS.map((v) => {
        const isActive = active === v.value;
        const Icon = v.icon;
        return (
          <Link
            key={v.value}
            href={hrefFor(v.value, currentParams)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              isActive ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" />
            {v.label}
          </Link>
        );
      })}
    </div>
  );
}
