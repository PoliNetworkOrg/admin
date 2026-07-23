import { Link, useRouterState } from "@tanstack/react-router"
import { ChevronRight, LogOut } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import type { AdminSession } from "@/server/api.functions"
import { AppMark } from "./app-mark"
import { accountNavigation, dashboardNavigation, overviewNavigation } from "./dashboard-navigation"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
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

// Shared height and visual treatment for every primary nav row.
const navItemClass = "h-10 gap-2.5 rounded-lg px-2.5"

// The single strong "selected page" treatment: a controlled PoliNetwork-blue surface.
const selectedPageClass =
  "data-active:bg-sidebar-primary/15 data-active:font-medium data-active:text-sidebar-accent-foreground data-active:hover:bg-sidebar-primary/20"

type DashboardSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: AdminSession["user"] | undefined
  loggingOut: boolean
  onLogout: () => void
}

export function DashboardSidebar({ user, loggingOut, onLogout, ...props }: DashboardSidebarProps) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
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

  const accountActive = isPathActive(pathname, accountNavigation.url)

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="h-16 shrink-0 justify-center border-b border-sidebar-border px-3">
        <AppMark onClick={() => setOpenMobile(false)} className="min-w-0" />
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup className="gap-0.5">
          <SidebarMenu className="gap-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={overviewNavigation.title}
                isActive={isPathActive(pathname, overviewNavigation.url, true)}
                render={<Link to={overviewNavigation.url} onClick={() => setOpenMobile(false)} />}
                className={cn(navItemClass, selectedPageClass)}
              >
                <overviewNavigation.icon />
                <span>{overviewNavigation.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {dashboardNavigation.map((category) => {
              const itemActiveStates = category.items.map((item) => isPathActive(pathname, item.url))
              const routeIsActive = itemActiveStates.some(Boolean)
              const open = categoryState[category.title] ?? routeIsActive
              const connectorHeight = category.items.length * 38 + 2
              const itemCenters = category.items.map((_, index) => 20 + index * 38)
              const lastItemIndex = category.items.length - 1
              const lastItemCenter = itemCenters[lastItemIndex]
              const inactiveBranches = itemCenters
                .map((center, index) =>
                  !itemActiveStates[index] && index !== lastItemIndex ? `M 0 ${center} H 10` : ""
                )
                .filter(Boolean)
                .join(" ")
              const railPath = [
                `M 0 2 V ${lastItemCenter}`,
                !itemActiveStates[lastItemIndex] ? "H 10" : "",
                inactiveBranches,
              ]
                .filter(Boolean)
                .join(" ")

              return (
                <Collapsible
                  key={category.title}
                  open={open}
                  onOpenChange={(nextOpen) => persistCategory(category.title, nextOpen)}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip={category.title}
                      render={<CollapsibleTrigger />}
                      className={cn(
                        navItemClass,
                        "text-sidebar-foreground/80",
                        routeIsActive && "bg-sidebar-accent/40 text-sidebar-accent-foreground"
                      )}
                    >
                      {category.iconSrc ? (
                        <img src={category.iconSrc} alt="" className="size-[15px] shrink-0 object-contain" />
                      ) : (
                        <category.icon />
                      )}
                      <span>{category.title}</span>
                      <ChevronRight className="ml-auto text-sidebar-foreground/60 transition-transform duration-150 group-data-open/collapsible:rotate-90" />
                    </SidebarMenuButton>
                    <CollapsibleContent>
                      <SidebarMenuSub className="relative mt-0.5 mr-0 gap-0.5 border-0 pe-0">
                        <svg
                          aria-hidden="true"
                          viewBox={`0 0 10 ${connectorHeight}`}
                          className="pointer-events-none absolute top-0 left-0 h-full w-2.5 overflow-visible text-sidebar-border"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                          shapeRendering="crispEdges"
                        >
                          <path d={railPath} vectorEffect="non-scaling-stroke" />
                          {itemCenters.map((center, index) =>
                            itemActiveStates[index] ? (
                              <g key={category.items[index].url} className="text-sidebar-primary">
                                <path d={`M 0 ${center} H 10`} vectorEffect="non-scaling-stroke" />
                                <circle cx="0" cy={center} r="6" fill="currentColor" stroke="none" opacity="0.2" />
                                <circle cx="0" cy={center} r="3" fill="currentColor" stroke="none" />
                              </g>
                            ) : null
                          )}
                        </svg>
                        {category.items.map((item, index) => {
                          const itemIsActive = itemActiveStates[index]

                          return (
                            <SidebarMenuSubItem key={item.url}>
                              <SidebarMenuSubButton
                                isActive={itemIsActive}
                                render={<Link to={item.url} onClick={() => setOpenMobile(false)} />}
                                className={cn(
                                  "h-9 gap-2.5 rounded-lg pl-2.5 text-sidebar-foreground/70",
                                  "data-active:bg-sidebar-primary/15 data-active:font-medium data-active:text-sidebar-accent-foreground data-active:hover:bg-sidebar-primary/20",
                                  "[&>svg]:text-sidebar-foreground/50 data-active:[&>svg]:text-sidebar-primary"
                                )}
                              >
                                <item.icon />
                                <span>{item.title}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    isActive={accountActive}
                    className="h-12 gap-2.5 rounded-lg px-1.5 data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground data-active:bg-sidebar-accent/50"
                  />
                }
              >
                <Avatar className="size-8 shrink-0 after:border-sidebar-border">
                  {user?.image && <AvatarImage src={user.image} alt={user.name || "Account avatar"} />}
                  <AvatarFallback className="bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
                    {initials(user?.name, user?.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold">
                  {user?.name || "PoliNetwork member"}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" sideOffset={6}>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    render={<Link to={accountNavigation.url} onClick={() => setOpenMobile(false)} />}
                    className="h-10 gap-2.5 px-2.5 py-0"
                  >
                    <accountNavigation.icon />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={onLogout}
                    disabled={loggingOut}
                    className="h-10 gap-2.5 px-2.5 py-0"
                  >
                    <LogOut />
                    <span>{loggingOut ? "Signing out…" : "Sign out"}</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
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

function isPathActive(pathname: string, url: string, exact = false) {
  const normalizedPathname = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  const normalizedUrl = url.length > 1 ? url.replace(/\/+$/, "") : url

  return normalizedPathname === normalizedUrl || (!exact && normalizedPathname.startsWith(`${normalizedUrl}/`))
}
