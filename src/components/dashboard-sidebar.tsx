import { Link, useRouterState } from "@tanstack/react-router"
import { ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

const categoryStorageKey = "polinetwork-sidebar-categories"

// Shared height for every primary nav row, kept within the 40–44px comfort range.
// `sidebar-row` is a stable marker for the collapsed-rail CSS: CollapsibleTrigger
// overwrites this button's `data-slot` with its own, so selectors can't rely on it.
const navItemClass =
  "sidebar-row h-10 gap-2.5 rounded-lg px-2.5 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:mx-auto"

// The single strong "selected page" treatment: a controlled PoliNetwork-blue surface.
const selectedPageClass =
  "data-active:bg-sidebar-primary/15 data-active:font-medium data-active:text-sidebar-accent-foreground data-active:hover:bg-sidebar-primary/20"

type DashboardSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user: AdminSession["user"] | undefined
  loggingOut: boolean
  onLogout: () => void
}

export function DashboardSidebar({ user, loggingOut, onLogout, ...props }: DashboardSidebarProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { setOpenMobile, setOpen, state, isMobile, toggleSidebar } = useSidebar()
  const [categoryState, setCategoryState] = useState<Record<string, boolean>>({})
  const collapsedDesktop = state === "collapsed" && !isMobile

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

  const accountActive = pathname.startsWith(accountNavigation.url)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-16 shrink-0 justify-center border-b border-sidebar-border px-3 group-data-[collapsible=icon]:px-0">
        <div className="relative flex items-center group-data-[collapsible=icon]:justify-center">
          <AppMark
            sidebarResponsive
            onClick={() => setOpenMobile(false)}
            className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:transition-opacity group-data-[collapsible=icon]:group-hover:opacity-0 group-data-[collapsible=icon]:group-focus-within:opacity-0"
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
                  onClick={toggleSidebar}
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/70 outline-none transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring [&_svg]:size-[18px]",
                    // In the collapsed rail the button overlays the logo and is revealed on hover/focus.
                    "group-data-[collapsible=icon]:absolute group-data-[collapsible=icon]:inset-0 group-data-[collapsible=icon]:m-auto group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:transition-opacity group-data-[collapsible=icon]:group-hover:opacity-100 group-data-[collapsible=icon]:group-focus-within:opacity-100"
                  )}
                >
                  {state === "collapsed" ? <PanelLeftOpen /> : <PanelLeftClose />}
                </button>
              }
            />
            <TooltipContent side="right" hidden={isMobile}>
              {state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup className="gap-0.5">
          <SidebarMenu className="gap-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={overviewNavigation.title}
                isActive={pathname === overviewNavigation.url || pathname === `${overviewNavigation.url}/`}
                render={<Link to={overviewNavigation.url} onClick={() => setOpenMobile(false)} />}
                className={cn(navItemClass, selectedPageClass)}
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
                  onOpenChange={(nextOpen) => {
                    // While collapsed the panel is hidden, so a click should always leave
                    // the category expanded once the rail grows back to full width.
                    persistCategory(category.title, collapsedDesktop ? true : nextOpen)
                  }}
                  className="group/collapsible"
                >
                  <CollapsibleTrigger
                    render={
                      <SidebarMenuButton
                        title={category.title}
                        tooltip={category.title}
                        aria-expanded={open}
                        onClick={() => {
                          // Collapsed rail: expand the whole sidebar to reveal the sub-items
                          // instead of relying on a hover-only flyout.
                          if (collapsedDesktop) setOpen(true)
                        }}
                        className={cn(
                          navItemClass,
                          "text-sidebar-foreground/80",
                          // Subtle emphasis for the expanded parent — distinct from the selected page.
                          "group-data-open/collapsible:bg-sidebar-accent/40 group-data-open/collapsible:text-sidebar-accent-foreground",
                          routeIsActive && "text-sidebar-foreground"
                        )}
                      />
                    }
                  >
                    {category.iconSrc ? (
                      <img src={category.iconSrc} alt="" className="size-[15px] shrink-0 object-contain" />
                    ) : (
                      <category.icon />
                    )}
                    <span>{category.title}</span>
                    <ChevronRight className="ml-auto text-sidebar-foreground/60 transition-transform duration-150 group-data-open/collapsible:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="sidebar-tree mx-0 mt-0.5 translate-x-0 gap-0.5 border-0 py-0 ps-[30px] pe-0">
                      {category.items.map((item) => (
                        <SidebarMenuSubItem key={item.url} className="sidebar-branch">
                          <SidebarMenuSubButton
                            isActive={pathname.startsWith(item.url)}
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
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-1 border-t border-sidebar-border p-2">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={`${user?.name || "Account"} — settings`}
              isActive={accountActive}
              render={<Link to={accountNavigation.url} onClick={() => setOpenMobile(false)} />}
              className={cn(
                "sidebar-row h-12 gap-2.5 rounded-lg px-1.5 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0!",
                "data-active:bg-sidebar-accent/50"
              )}
            >
              <Avatar className="size-8 shrink-0 after:border-sidebar-border">
                {user?.image && <AvatarImage src={user.image} alt={user.name || "Account avatar"} />}
                <AvatarFallback className="bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
                  {initials(user?.name, user?.email)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 leading-tight">
                <b className="block truncate text-[13px] font-semibold">{user?.name || "PoliNetwork member"}</b>
                <small className="block truncate text-[11px] text-sidebar-foreground/60">
                  {user?.email || "Open account settings"}
                </small>
              </span>
              <accountNavigation.icon className="shrink-0 text-sidebar-foreground/60" />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={onLogout}
              disabled={loggingOut}
              className="sidebar-row h-9 gap-2.5 rounded-lg px-2.5 text-sidebar-foreground/75 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:mx-auto hover:bg-destructive/15 hover:text-destructive focus-visible:bg-destructive/15 focus-visible:text-destructive"
            >
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
