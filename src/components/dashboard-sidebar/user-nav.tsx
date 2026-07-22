"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FiBell, FiChevronsDown, FiLogOut, FiUser } from "react-icons/fi"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { signOut, useSession } from "@/lib/auth"
import { getInitials } from "@/lib/utils"
import { Skeleton } from "../ui/skeleton"

export function DSUserNav() {
  const { data } = useSession()
  const { isMobile } = useSidebar()
  const router = useRouter()

  const user = data?.user

  if (!user) return <Skeleton />

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <Avatar className="size-8">
                  <AvatarImage src={user.image ?? undefined} alt={user.name} />
                  <AvatarFallback>{user.name ? getInitials(user.name) : <FiUser size={48} />}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
                <FiChevronsDown className="ml-auto size-4" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="size-8">
                    <AvatarImage src={user.image ?? undefined} alt={user.name} />
                    <AvatarFallback>{user.name ? getInitials(user.name) : <FiUser size={48} />}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <Link href="/dashboard/account">
                <DropdownMenuItem>
                  <FiUser />
                  Account
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem disabled>
                <FiBell />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      toast.success("Logged out!")
                      router.refresh()
                    },
                  },
                })
              }
            >
              <FiLogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
