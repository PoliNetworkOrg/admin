import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router"
import { BookOpen, Database, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, UsersRound, X } from "lucide-react"
import { useState } from "react"
import azureIcon from "@/assets/svg/azure.svg"
import telegramIcon from "@/assets/svg/telegram.svg"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { auth, useSession } from "@/lib/auth"
import { cn } from "@/lib/utils"
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

function currentTitle(pathname: string) {
  if (pathname.includes("/telegram/users/")) return "Member details"
  if (pathname.includes("/telegram/users")) return "Users"
  if (pathname.includes("/telegram/groups")) return "Groups"
  if (pathname.includes("/telegram/grants")) return "Access grants"
  if (pathname.includes("/azure/members")) return "Members"
  if (pathname.includes("/web/guides")) return "Guides"
  if (pathname.includes("/account")) return "Account"
  return "Overview"
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
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const router = useRouter()
  const sessionQuery = useSession()
  const session = (sessionQuery.data as AdminSession | null) ?? initialSession
  const user = session.user
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  async function logout() {
    setLoggingOut(true)
    await auth.signOut()
    await router.invalidate()
    await router.navigate({ to: "/login", replace: true })
  }

  return (
    <div className="grid min-h-dvh grid-cols-[248px_minmax(0,1fr)] bg-background max-[960px]:grid-cols-1">
      <aside
        data-open={open}
        className={cn(
          "sticky top-0 z-50 flex h-dvh flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground",
          "max-[960px]:fixed max-[960px]:left-0 max-[960px]:w-[280px] max-[960px]:-translate-x-full max-[960px]:shadow-xl max-[960px]:transition-transform max-[960px]:duration-200",
          open && "max-[960px]:translate-x-0"
        )}
      >
        <div className="flex h-11 items-center justify-between px-2">
          <AppMark />
          <Button
            variant="ghost"
            size="icon"
            className="hidden max-[960px]:inline-flex"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>
        <Separator className="my-4 bg-sidebar-border" />
        <nav className="flex flex-col gap-5" aria-label="Main navigation">
          <div className="flex flex-col gap-1">
            {navigation.map(({ label, to, icon: Icon }) => (
              <NavLink key={to} to={to} label={label} icon={Icon} exact onNavigate={() => setOpen(false)} />
            ))}
          </div>
          {navigationGroups.map(({ label, iconSrc, items }) => (
            <section key={label} aria-labelledby={`${label.toLowerCase()}-nav-label`}>
              <div
                id={`${label.toLowerCase()}-nav-label`}
                className="mb-1 flex h-7 items-center gap-2 px-3 text-[10px] font-semibold tracking-[0.08em] text-sidebar-foreground/45 uppercase"
              >
                {iconSrc ? (
                  <img src={iconSrc} alt="" className="size-4 object-contain" />
                ) : (
                  <BookOpen className="size-4" />
                )}
                <span>{label}</span>
              </div>
              <div className="flex flex-col gap-1">
                {items.map(({ label: itemLabel, to, icon }) => (
                  <NavLink key={to} to={to} label={itemLabel} icon={icon} onNavigate={() => setOpen(false)} />
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="mt-auto">
          <Separator className="mb-3 bg-sidebar-border" />
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent p-2">
            <Link
              to="/dashboard/account"
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center gap-3 rounded-lg px-1.5 transition-colors hover:bg-sidebar"
            >
              <Avatar>
                {user?.image && <AvatarImage src={user.image} alt={user.name || "Account avatar"} />}
                <AvatarFallback className="bg-primary text-[10px] font-semibold text-primary-foreground">
                  {initials(user?.name, user?.email)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-xs font-semibold">{user?.name || "PoliNetwork member"}</b>
                <small className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-sidebar-foreground/55">
                  <Settings className="size-3" /> Account settings
                </small>
              </span>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 w-full justify-start text-sidebar-foreground/60 hover:bg-sidebar hover:text-sidebar-foreground"
              onClick={() => void logout()}
              disabled={loggingOut}
            >
              <LogOut data-icon="inline-start" /> Sign out
            </Button>
          </div>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 hidden border-0 bg-foreground/40 max-[960px]:block"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}

      <main className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur-sm max-[640px]:px-3">
          <Button
            variant="ghost"
            size="icon"
            className="hidden max-[960px]:inline-flex"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              PoliNetwork admin
            </p>
            <h1 className="truncate text-base font-semibold tracking-[-0.02em]">{currentTitle(pathname)}</h1>
          </div>
          <ThemeToggle />
        </header>
        <div className="mx-auto max-w-[1400px] px-6 py-7 max-[640px]:px-3 max-[640px]:py-5">
          <Outlet />
        </div>
      </main>
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
      className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/68 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      activeProps={{
        className:
          "flex min-h-10 items-center gap-3 rounded-lg bg-sidebar-primary px-3 text-sm font-semibold text-sidebar-primary-foreground",
      }}
      activeOptions={{ exact }}
    >
      <Icon className="size-[18px]" />
      <span>{label}</span>
    </Link>
  )
}
