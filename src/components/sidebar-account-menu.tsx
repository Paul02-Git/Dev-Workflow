"use client";

import { useRouter } from "next/navigation";
import { MoreVerticalIcon, SettingsIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogoutButton } from "@/components/logout-button";
import { logoutAction } from "@/lib/auth-actions";

/**
 * Only real entries here — this app has no "Upgrade to Pro"/"Billing"/
 * separate "Notifications" settings page, so those don't appear just
 * because a reference screenshot had them. Settings links to the real
 * /settings page already in the main nav; Log out reuses the existing
 * confirm-dialog flow (LogoutButton) rather than duplicating it — its
 * trigger is rendered as a plain styled button, not wrapped in a
 * DropdownMenuItem, since nesting its own interactive button/dialog
 * inside Base UI's Menu.Item composite would conflict with that
 * component's own focus/keyboard handling.
 */
export function SidebarAccountMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const initial = name.charAt(0).toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-sidebar-accent"
          />
        }
      >
        <Avatar>
          <AvatarFallback className="bg-[#eef2fb] font-bold text-[#2a4d8f]">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium leading-tight">{name}</div>
          {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
        </div>
        <MoreVerticalIcon className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-64">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar>
            <AvatarFallback className="bg-[#eef2fb] font-bold text-[#2a4d8f]">{initial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{name}</div>
            {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
          </div>
        </div>
        <div className="my-1 h-px bg-border" />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <SettingsIcon className="size-4" />
          Settings
        </DropdownMenuItem>
        <div className="my-1 h-px bg-border" />
        <LogoutButton
          action={logoutAction}
          triggerLabel="Log out"
          triggerClassName="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-[#d03b3b] hover:bg-accent"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
