"use client"
import { LogOutIcon, Settings2, UserIcon } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
              <AvatarImage src={data.user.image || undefined} alt={`propic of ${data.user.name}`} />
              <AvatarFallback className="rounded-full text-base text-foreground">
                {data.user.name ? getInitials(data.user.name) : <UserIcon className="size-5" />}
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
