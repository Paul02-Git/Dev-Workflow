import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/tasks", label: "Tasks" },
  { href: "/today", label: "Today" },
  { href: "/clients", label: "Clients" },
  { href: "/templates", label: "Workflow Templates" },
  { href: "/qa", label: "QA" },
  { href: "/reports", label: "Reports" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#f9f9f7] text-[#0b0b0b]">
      <aside className="w-56 shrink-0 border-r border-black/10 bg-[#fcfcfb] p-4">
        <div className="mb-6 flex items-center gap-2 border-b border-black/10 pb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#2a78d6] text-xs font-bold text-white">
            DX
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Workflow OS</div>
            <div className="text-[11px] text-[#898781]">MVP</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-[#52514e] hover:bg-[#cde2fb] hover:text-[#184f95]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
