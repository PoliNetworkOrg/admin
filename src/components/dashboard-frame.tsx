import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router"
import { Database, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, UsersRound } from "lucide-react"
import { useState } from "react"
import { auth, useSession } from "@/lib/auth"
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
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const title = currentTitle(pathname)

  async function logout() {
    setLoggingOut(true)
    await auth.signOut()
    await router.invalidate()
    await router.navigate({ to: "/login", replace: true })
  }
  return (
    <div className="console-shell">
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <div className="sidebar-head">
          <AppMark />
          <button className="icon-button mobile-close" onClick={() => setOpen(false)} aria-label="Close navigation">
            ×
          </button>
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          <p>WORKSPACE</p>
          {navigation.map(({ label, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="nav-link"
              activeProps={{ className: "nav-link active" }}
              activeOptions={{ exact: to === "/dashboard" }}
            >
              <Icon size={17} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link to="/dashboard/account" className="nav-link">
            <Settings size={17} />
            <span>Account settings</span>
          </Link>
          <div className="operator-card">
            {user?.image ? (
              <img className="operator-avatar-image" src={user.image} alt="" />
            ) : (
              <span className="operator-avatar">{initials(user?.name, user?.email)}</span>
            )}
            <span>
              <b>{user?.name || "PoliNetwork member"}</b>
              <small>{user?.email || "Authenticated account"}</small>
            </span>
            <button
              className="logout-button"
              onClick={() => void logout()}
              disabled={loggingOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      {open && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <main className="console-main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button menu-button" onClick={() => setOpen(true)} aria-label="Open navigation">
              <Menu size={19} />
            </button>
            <div>
              <p className="eyebrow">POLINETWORK / {title.toUpperCase()}</p>
              <h1>{title}</h1>
            </div>
          </div>
        </header>
        <div className="page-stage">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
