"use client"
import { LogOutIcon, Settings2 } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut, useSession } from "@/lib/auth"
import { getInitials } from "@/lib/utils"

export function RightNav() {
  const { data } = useSession()

  return data ? (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar size="lg">
              <AvatarFallback className="text-foreground text-base">
                {data.user.name ? getInitials(data.user.name) : data.user.email.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={10}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <Link href="/dashboard/account">
            <DropdownMenuItem>
              <Settings2 />
              Settings
            </DropdownMenuItem>
          </Link>
          <DropdownMenuItem
            onClick={async () => {
              await signOut()
              redirect("/login")
            }}
            variant="destructive"
          >
            <LogOutIcon /> Logout
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <div className="size-9 rounded-full bg-accent animate-pulse" />
  )
}
