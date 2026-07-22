import { Link, useRouterState } from "@tanstack/react-router"
import { ChevronRight, LogOut } from "lucide-react"
import { useEffect, useState } from "react"
import type { AdminSession } from "@/server/api.functions"
import { AppMark } from "./app-mark"
import { accountNavigation, dashboardNavigation, overviewNavigation } from "./dashboard-navigation"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "./ui/sidebar"

const categoryStorageKey = "polinetwork-sidebar-categories"

type DashboardSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: AdminSession["user"] | undefined
  loggingOut: boolean
  onLogout: () => void
}

export function DashboardSidebar({ user, loggingOut, onLogout, ...props }: DashboardSidebarProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { setOpenMobile } = useSidebar()
  const [categoryState, setCategoryState] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(categoryStorageKey)
      if (stored) setCategoryState(JSON.parse(stored))
    } catch {
      // Ignore malformed or unavailable local storage and use route-based defaults.
    }
  }, [])

  function persistCategory(title: string, open: boolean) {
    setCategoryState((current) => {
      const next = { ...current, [title]: open }
      try {
        window.localStorage.setItem(categoryStorageKey, JSON.stringify(next))
      } catch {
        // The in-memory state still works when storage is unavailable.
      }
      return next
    })
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-16 shrink-0 justify-center border-b border-sidebar-border px-4 group-data-[collapsible=icon]:px-2">
        <AppMark sidebarResponsive onClick={() => setOpenMobile(false)} />
      </SidebarHeader>

      <SidebarContent className="py-3">
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip={overviewNavigation.title}
                isActive={pathname === overviewNavigation.url || pathname === `${overviewNavigation.url}/`}
                render={<Link to={overviewNavigation.url} onClick={() => setOpenMobile(false)} />}
              >
                <overviewNavigation.icon />
                <span>{overviewNavigation.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {dashboardNavigation.map((category) => {
              const routeIsActive = category.items.some((item) => pathname.startsWith(item.url))
              const open = categoryState[category.title] ?? routeIsActive

              return (
                <Collapsible
                  key={category.title}
                  render={<SidebarMenuItem />}
                  open={open}
                  onOpenChange={(nextOpen) => persistCategory(category.title, nextOpen)}
                  className="group/collapsible"
                >
                  <CollapsibleTrigger
                    render={<SidebarMenuButton size="lg" isActive={routeIsActive} title={category.title} />}
                  >
                    {category.iconSrc ? (
                      <img src={category.iconSrc} alt="" className="size-4 object-contain" />
                    ) : (
                      <category.icon />
                    )}
                    <span>{category.title}</span>
                    <ChevronRight className="ml-auto transition-transform group-data-open/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {category.items.map((item) => (
                        <SidebarMenuSubItem key={item.url}>
                          <SidebarMenuSubButton
                            isActive={pathname.startsWith(item.url)}
                            render={<Link to={item.url} onClick={() => setOpenMobile(false)} />}
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu className="overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-accent/30">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={accountNavigation.title}
              isActive={pathname.startsWith(accountNavigation.url)}
              render={<Link to={accountNavigation.url} onClick={() => setOpenMobile(false)} />}
              className="h-14 rounded-b-none"
            >
              <Avatar className="size-8 after:border-sidebar-border">
                {user?.image && <AvatarImage src={user.image} alt={user.name || "Account avatar"} />}
                <AvatarFallback className="bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
                  {initials(user?.name, user?.email)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 leading-tight">
                <b className="block truncate text-xs font-semibold">{user?.name || "PoliNetwork member"}</b>
                <small className="mt-1 block truncate text-[10px] text-sidebar-foreground/65">
                  {user?.email || "Open account settings"}
                </small>
              </span>
              <accountNavigation.icon />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="border-t border-sidebar-border">
            <SidebarMenuButton tooltip="Sign out" onClick={onLogout} disabled={loggingOut} className="rounded-t-none">
              <LogOut />
              <span>{loggingOut ? "Signing out…" : "Sign out"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function initials(name?: string | null, email?: string) {
  const source = name?.trim() || email?.split("@")[0] || "User"
  return source
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}
