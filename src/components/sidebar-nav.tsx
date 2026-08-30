"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  FolderIcon,
  UsersIcon,
  WrenchIcon,
  LayersIcon,
  BarChart3Icon,
  PlugIcon,
  SettingsIcon,
  ShieldIcon,
  type LucideIcon,
} from "lucide-react";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";

// Keyed by href here (a client component) rather than passed in from the
// server layout's NAV array — icon components are functions, and
// functions can't be passed as props across the server/client boundary
// (only Server Actions get that special handling).
const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboardIcon,
  "/projects": FolderIcon,
  "/clients": UsersIcon,
  "/maintenance": WrenchIcon,
  "/templates": LayersIcon,
  "/reports": BarChart3Icon,
  "/integrations": PlugIcon,
  "/settings": SettingsIcon,
  "/admin": ShieldIcon,
};

export function SidebarNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        const Icon = NAV_ICONS[item.href];
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton render={<Link href={item.href} />} isActive={isActive}>
              {Icon && <Icon className="size-4" />}
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
