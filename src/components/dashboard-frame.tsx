import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router"
import { BookOpen, Database, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, UsersRound, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import azureIcon from "@/assets/svg/azure.svg"
import telegramIcon from "@/assets/svg/telegram.svg"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { auth, useSession } from "@/lib/auth"
import type { AdminSession } from "@/server/api.functions"
import { AppMark } from "./app-mark"
import { ThemeToggle } from "./theme-toggle"

const navigation = [{ label: "Overview", to: "/dashboard", icon: LayoutDashboard }] as const

const navigationGroups = [
  {
    label: "Telegram",
    iconSrc: telegramIcon,
    items: [
      { label: "Users", to: "/dashboard/telegram/users", icon: UsersRound },
      { label: "Groups", to: "/dashboard/telegram/groups", icon: Database },
      { label: "Access grants", to: "/dashboard/telegram/grants", icon: ShieldCheck },
    ],
  },
  {
    label: "Azure",
    iconSrc: azureIcon,
    items: [{ label: "Members", to: "/dashboard/azure/members", icon: UsersRound }],
  },
  {
    label: "Web",
    iconSrc: undefined,
    items: [{ label: "Guides", to: "/dashboard/web/guides", icon: BookOpen }],
  },
] as const

function currentPage(pathname: string) {
  if (pathname.includes("/telegram/users/")) return { group: "Telegram / Users", title: "Member details" }
  if (pathname.includes("/telegram/users")) return { group: "Telegram", title: "Users" }
  if (pathname.includes("/telegram/groups")) return { group: "Telegram", title: "Groups" }
  if (pathname.includes("/telegram/grants")) return { group: "Telegram", title: "Access grants" }
  if (pathname.includes("/azure/members")) return { group: "Azure", title: "Members" }
  if (pathname.includes("/web/guides")) return { group: "Web", title: "Guides" }
  if (pathname.includes("/account")) return { group: "Workspace", title: "Account" }
  return { group: "Workspace", title: "Overview" }
}

function initials(name?: string | null, email?: string) {
  const source = name?.trim() || email?.split("@")[0] || "User"
  return source
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

export function DashboardFrame({ initialSession }: { initialSession: AdminSession }) {
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const router = useRouter()
  const sessionQuery = useSession()
  const liveSession = sessionQuery.data as AdminSession | null | undefined
  const session = liveSession === undefined ? initialSession : liveSession
  const user = session?.user
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const page = currentPage(pathname)

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const result = await auth.signOut()
      if (result.error) throw new Error(result.error.message)
      await router.invalidate()
      await router.navigate({ to: "/login", replace: true })
    } catch {
      toast.error("Could not sign out. Please try again.")
      setLoggingOut(false)
    }
  }

  const sidebar = (onNavigate: () => void, mobile = false) => (
    <SidebarContent
      user={user}
      loggingOut={loggingOut}
      onLogout={() => void logout()}
      onNavigate={onNavigate}
      mobile={mobile}
    />
  )

  return (
    <div className="grid min-h-dvh grid-cols-[260px_minmax(0,1fr)] bg-background max-[960px]:grid-cols-1">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground min-[961px]:flex">
        {sidebar(() => undefined)}
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/92 px-7 backdrop-blur-xl max-[640px]:px-4">
          <Dialog open={navigationOpen} onOpenChange={setNavigationOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden max-[960px]:inline-flex"
                  aria-label="Open navigation"
                  aria-controls="mobile-navigation"
                />
              }
            >
              <Menu />
            </DialogTrigger>
            <DialogContent id="mobile-navigation" side="left" showCloseButton={false}>
              {sidebar(() => setNavigationOpen(false), true)}
            </DialogContent>
          </Dialog>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              {page.group}
            </p>
            <h1 className="truncate text-sm font-semibold tracking-[-0.01em]">{page.title}</h1>
          </div>
          <ThemeToggle />
        </header>
        <div className="mx-auto max-w-[1440px] px-7 py-8 max-[640px]:px-4 max-[640px]:py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function SidebarContent({
  user,
  loggingOut,
  onLogout,
  onNavigate,
  mobile,
}: {
  user: AdminSession["user"] | undefined
  loggingOut: boolean
  onLogout: () => void
  onNavigate: () => void
  mobile: boolean
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-5">
        <AppMark />
        {mobile && (
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                aria-label="Close navigation"
              />
            }
          >
            <X />
          </DialogClose>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-5" aria-label="Main navigation">
        <div className="mb-6">
          {navigation.map(({ label, to, icon }) => (
            <NavLink key={to} to={to} label={label} icon={icon} exact onNavigate={onNavigate} />
          ))}
        </div>

        <div className="grid gap-6">
          {navigationGroups.map(({ label, iconSrc, items }) => (
            <section key={label} aria-labelledby={`${label.toLowerCase()}-nav-label`}>
              <div
                id={`${label.toLowerCase()}-nav-label`}
                className="mb-2 flex items-center gap-2 px-3 text-[10px] font-semibold tracking-[0.1em] text-sidebar-foreground/65 uppercase"
              >
                {iconSrc ? (
                  <img src={iconSrc} alt="" className="size-4 object-contain opacity-90" />
                ) : (
                  <BookOpen className="size-4" />
                )}
                <span>{label}</span>
              </div>
              <div className="grid gap-1">
                {items.map(({ label: itemLabel, to, icon }) => (
                  <NavLink key={to} to={to} label={itemLabel} icon={icon} onNavigate={onNavigate} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div className="overflow-hidden rounded-xl border border-sidebar-border bg-white/[0.04]">
          <Link
            to="/dashboard/account"
            onClick={onNavigate}
            className="group flex min-h-16 items-center gap-3 px-3 py-2.5 outline-none transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent"
            activeProps={{ className: "bg-sidebar-accent" }}
          >
            <Avatar className="size-9 after:border-white/15">
              {user?.image && <AvatarImage src={user.image} alt={user.name || "Account avatar"} />}
              <AvatarFallback className="bg-white/10 text-xs font-semibold text-white">
                {initials(user?.name, user?.email)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-xs font-semibold text-white">{user?.name || "PoliNetwork member"}</b>
              <small className="mt-1 block truncate text-[10px] text-sidebar-foreground/65">
                {user?.email || "Open account settings"}
              </small>
            </span>
            <Settings className="size-4 text-sidebar-foreground/55 transition-colors group-hover:text-white" />
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start rounded-none border-t border-sidebar-border px-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white"
            onClick={onLogout}
            disabled={loggingOut}
          >
            <LogOut data-icon="inline-start" /> {loggingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function NavLink({
  to,
  label,
  icon: Icon,
  exact,
  onNavigate,
}: {
  to: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
  onNavigate: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-sidebar-foreground/72 outline-none transition-colors before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-transparent hover:bg-sidebar-accent hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring/60"
      activeProps={{
        className:
          "bg-sidebar-accent text-white before:bg-sidebar-primary shadow-[inset_0_0_0_1px_rgb(255_255_255/5%)]",
      }}
      activeOptions={{ exact }}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </Link>
  )
}
