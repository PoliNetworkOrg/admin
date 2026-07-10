import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router"
import { Database, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, UsersRound, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { auth, useSession } from "@/lib/auth"
import { cn } from "@/lib/utils"
import type { AdminSession } from "@/server/api.functions"
import { AppMark } from "./app-mark"

const navigation = [
  { label: "Overview", to: "/dashboard", icon: LayoutDashboard },
  { label: "Telegram users", to: "/dashboard/telegram/users", icon: UsersRound },
  { label: "Groups", to: "/dashboard/telegram/groups", icon: Database },
  { label: "Access grants", to: "/dashboard/telegram/grants", icon: ShieldCheck },
  { label: "Azure members", to: "/dashboard/azure/members", icon: UsersRound },
] as const

function currentTitle(pathname: string) {
  return (
    navigation.find((item) => item.to === pathname)?.label ??
    (pathname.includes("/account") ? "Account" : "Member profile")
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

export function DashboardFrame({ initialSession }: { initialSession: AdminSession }) {
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const router = useRouter()
  const sessionQuery = useSession()
  const session = (sessionQuery.data as AdminSession | null) ?? initialSession
  const user = session.user
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const title = currentTitle(pathname)

  async function logout() {
    setLoggingOut(true)
    await auth.signOut()
    await router.invalidate()
    await router.navigate({ to: "/login", replace: true })
  }

  return (
    <div className="grid min-h-screen grid-cols-[274px_minmax(0,1fr)] bg-background max-[900px]:grid-cols-1">
      <aside
        data-open={open}
        className={cn(
          "sticky top-0 z-50 flex h-screen flex-col bg-sidebar px-4 pt-[26px] pb-4 text-sidebar-foreground",
          "max-[900px]:fixed max-[900px]:left-0 max-[900px]:w-[274px] max-[900px]:-translate-x-full max-[900px]:transition-transform max-[900px]:duration-200",
          open && "max-[900px]:translate-x-0"
        )}
      >
        <div className="flex justify-between px-2.5 pb-[26px]">
          <AppMark />
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden rounded-none text-sidebar-foreground hover:bg-white/10 hover:text-white max-[900px]:inline-flex"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </Button>
        </div>
        <nav className="grid gap-[3px]" aria-label="Main navigation">
          <p className="px-2.5 pb-2 font-mono text-[9px] leading-none font-medium tracking-[0.12em] text-[#8191aa]">
            WORKSPACE
          </p>
          {navigation.map(({ label, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 border-l-2 border-transparent px-2.5 py-2.5 text-[13px] text-[#b8c5d8] transition-colors hover:bg-white/[0.06] hover:text-white"
              activeProps={{
                className:
                  "flex items-center gap-2.5 border-l-2 border-[#75adf4] bg-[#508fe0]/[0.18] px-2.5 py-2.5 text-[13px] text-[#f5f7ec]",
              }}
              activeOptions={{ exact: to === "/dashboard" }}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto grid gap-2.5">
          <Link
            to="/dashboard/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 border-l-2 border-transparent px-2.5 py-2.5 text-[13px] text-[#b8c5d8] transition-colors hover:bg-white/[0.06] hover:text-white"
            activeProps={{
              className:
                "flex items-center gap-2.5 border-l-2 border-[#75adf4] bg-[#508fe0]/[0.18] px-2.5 py-2.5 text-[13px] text-[#f5f7ec]",
            }}
          >
            <Settings className="size-5" />
            <span>Account settings</span>
          </Link>
          <div className="flex w-full items-center gap-2.5 bg-[#172c4d] p-2.5 text-left text-[#edf2ed]">
            {user?.image ? (
              <img className="size-7 shrink-0 rounded-full object-cover" src={user.image} alt="" />
            ) : (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sidebar-primary font-mono text-[10px] font-medium text-sidebar">
                {initials(user?.name, user?.email)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <b className="block text-[11px]">{user?.name || "PoliNetwork member"}</b>
              <small className="mt-0.5 block truncate text-[9px] text-[#91a2bd]">
                {user?.email || "Authenticated account"}
              </small>
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="shrink-0 rounded-none text-[#c7d3e4] hover:bg-white/[0.08] hover:text-white"
              onClick={() => void logout()}
              disabled={loggingOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </aside>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 hidden border-0 bg-[#0d1d36]/50 max-[900px]:block"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <main className="min-w-0">
        <header className="sticky top-0 z-40 flex h-[91px] items-center border-b border-border bg-background/90 px-[42px] backdrop-blur-[10px] max-[900px]:px-5 max-[600px]:h-[72px] max-[600px]:px-3.5">
          <div className="flex items-center gap-[15px]">
            <Button
              variant="ghost"
              size="icon"
              className="hidden rounded-none hover:bg-muted max-[900px]:inline-flex"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu />
            </Button>
            <div>
              <p className="font-mono text-[10px] leading-[1.3] font-medium tracking-[0.13em] text-muted-foreground">
                POLINETWORK / {title.toUpperCase()}
              </p>
              <h1 className="mt-1 text-[19px] tracking-[-0.04em] max-[600px]:text-base">{title}</h1>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1410px] px-[42px] py-[42px] max-[900px]:px-5 max-[900px]:py-7 max-[600px]:px-3.5 max-[600px]:py-[22px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
