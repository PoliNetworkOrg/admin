"use client";

import { ChevronsUpDown, LogOut, Settings, UserIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { getInitials } from "@/lib/utils";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";
import type { User } from "better-auth";

export function NavUser({ user }: { user: User }) {
  const router = useRouter()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
            >
              <Avatar className="h-8 w-8 rounded-lg border">
                <AvatarImage src={user.image ?? ""} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {user.name ? getInitials(user.name) : <UserIcon size={16} />}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side="top"
            align="start"
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <Link href="/dashboard/account">
                <DropdownMenuItem>
                  <Settings />
                  Account
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={async () => {
                  await signOut();
                  router.replace("/login");
                }}
              >
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
