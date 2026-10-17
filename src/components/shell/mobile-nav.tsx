import { Link } from "@tanstack/react-router"
import { Moon, Search, Sun } from "lucide-react"

import logoUrl from "@/assets/logo.png"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { AccountAvatar, type ShellUser } from "./account-avatar"
import { isRailService, type DashboardPath, type PageMatch, type PendingCounts, type Service, serviceFor } from "./nav"
import { ServiceDot } from "./rail"
import { ServiceGlyph } from "./service-glyph"
import { themeToggleLabel, useTheme } from "./theme"
import { useHasAdminAccess, useVisibleServices } from "./use-can"

const barButton = "size-10 text-(--pn-fg-muted) hover:text-(--pn-fg) active:not-aria-[haspopup]:translate-y-0"

export type MobileTopBarProps = {
  match: PageMatch
  onOpenPalette: () => void
  user: ShellUser
  className?: string
}

/**
 * Below 760px: the logo (Overview), the service title, search, theme and the account avatar. Overview shows the app
 * name instead of a service.
 */
export function MobileTopBar({ match, onOpenPalette, user, className }: MobileTopBarProps) {
  const service = serviceFor(match)
  const { theme, toggleTheme } = useTheme()
  const title = service.id === "overview" ? "PoliNetwork Admin" : service.title
  const hasAdminAccess = useHasAdminAccess()
  const accountPath = useVisibleServices().find((candidate) => candidate.id === "account")?.path ?? "/dashboard/account"

  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center gap-2.5 border-b border-(--pn-line) bg-(--pn-nav) pr-2.5 pl-3.5",
        className
      )}
    >
      <Link
        to={hasAdminAccess ? "/dashboard" : "/dashboard/account/me"}
        aria-label={hasAdminAccess ? "Overview" : "My area"}
        aria-current={service.id === "overview" ? "page" : undefined}
        className="grid size-9 shrink-0 place-items-center rounded-full"
      >
        <img src={logoUrl} alt="" width={28} height={28} className="size-7 rounded-full" />
      </Link>
      <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-(--pn-fg)">{title}</span>
      <Button variant="ghost" size="icon" aria-label="Search" onClick={onOpenPalette} className={barButton}>
        <Search aria-hidden strokeWidth={1.75} className="size-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={themeToggleLabel(theme)}
        data-theme-toggle=""
        onClick={toggleTheme}
        className={barButton}
      >
        <Sun aria-hidden strokeWidth={1.75} className="hidden size-5 dark:block" />
        <Moon aria-hidden strokeWidth={1.75} className="size-5 dark:hidden" />
      </Button>
      <Link
        to={accountPath}
        aria-label="Account"
        aria-current={service.id === "account" ? "page" : undefined}
        className="grid size-10 shrink-0 place-items-center rounded-full aria-[current=page]:[&>span]:shadow-[0_0_0_2px_var(--pn-nav),0_0_0_4px_var(--pn-accent-solid)]"
      >
        <AccountAvatar user={user} className="size-7.5" />
      </Link>
    </header>
  )
}

export type MobileBottomNavProps = {
  match: PageMatch
  serviceHref: (service: Service) => DashboardPath
  pending: PendingCounts
  className?: string
}

/** Below 760px: the five services as a bottom tab bar; the current one is accent with a top indicator. */
export function MobileBottomNav({ match, serviceHref, pending, className }: MobileBottomNavProps) {
  const services = useVisibleServices().filter(isRailService)
  const activeId = serviceFor(match).id

  return (
    <nav
      aria-label="Services"
      className={cn(
        "flex h-[calc(64px+env(safe-area-inset-bottom))] shrink-0 items-stretch border-t border-(--pn-line) bg-(--pn-nav) px-1 pb-[env(safe-area-inset-bottom)]",
        className
      )}
    >
      {services.map((service) => {
        const active = service.id === activeId
        return (
          <Link
            key={service.id}
            to={serviceHref(service)}
            aria-label={service.title}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-(--pn-fg-muted) transition-[color] duration-120 hover:text-(--pn-fg)",
              active &&
                "text-(--pn-accent) before:absolute before:inset-x-[28%] before:top-0 before:h-[3px] before:rounded-b-[3px] before:bg-(--pn-accent-solid) hover:text-(--pn-accent)"
            )}
          >
            <span className="relative">
              <ServiceGlyph service={service} className="size-5.5" />
              <ServiceDot service={service.id} pending={pending} className="-top-0.5 -right-1" />
            </span>
            <span aria-hidden className="max-w-full truncate">
              {service.id === "whatsapp" ? (
                <>
                  <span className="min-[360px]:hidden">WA</span>
                  <span className="max-[360px]:hidden">{service.short}</span>
                </>
              ) : (
                service.short
              )}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
