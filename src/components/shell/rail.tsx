import { Link } from "@tanstack/react-router"
import { Moon, Search, Sun } from "lucide-react"
import {
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  Suspense,
  use,
  useDeferredValue,
  useRef,
  useState,
} from "react"

import logoUrl from "@/assets/logo.png"
import { TOOLTIP_DELAY_SLOW } from "@/components/primitives/hint"
import { useModifierKey } from "@/components/primitives/use-modifier-key"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { AccountAvatar, type ShellUser } from "./account-avatar"
import {
  type DashboardPath,
  type PageMatch,
  type PendingCounts,
  type Service,
  type ServiceId,
  serviceById,
  serviceFor,
  servicePending,
} from "./nav"
import { ServiceGlyph } from "./service-glyph"
import { themeToggleLabel, useTheme } from "./theme"
import { useVisibleServices } from "./use-can"

const railItemClass =
  "relative grid size-10 shrink-0 place-items-center rounded-(--pn-r-3) text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:bg-(--pn-hover) hover:text-(--pn-fg)"

// The 3px indicator sits on the rail's left edge: items are inset 12px, hence -left-3.
const railIndicator =
  "before:absolute before:inset-y-2 before:-left-3 before:w-[3px] before:rounded-r-[3px] before:bg-(--pn-accent-solid)"
const railActiveClass = cn(
  "bg-(--pn-nav-active) text-(--pn-fg) hover:bg-(--pn-nav-active) hover:text-(--pn-fg)",
  railIndicator
)

type RailItemTarget =
  | { kind: "link"; to: DashboardPath }
  | { kind: "button"; onClick: (event: MouseEvent<HTMLButtonElement>) => void }

type RailItemProps = {
  label: string
  /** Tooltip text when it differs from the accessible label (the account shows the user's name). */
  tooltip?: string
  /** Extra tooltip content after the label, e.g. the ⌘K shortcut. */
  hint?: ReactNode
  active: boolean
  focusable: boolean
  target: RailItemTarget
  /** Marks the theme toggle: the palette's theme switch starts its reveal here, and presses during a reveal find it. */
  themeToggle?: boolean
  className?: string
  children: ReactNode
}

function RailItem({
  label,
  tooltip,
  hint,
  active,
  focusable,
  target,
  themeToggle,
  className,
  children,
}: RailItemProps) {
  const shared = {
    "aria-label": label,
    "data-rail-item": "",
    "data-theme-toggle": themeToggle ? "" : undefined,
    tabIndex: focusable ? 0 : -1,
    className: cn(railItemClass, active && railActiveClass, className),
  }
  const trigger =
    target.kind === "link" ? (
      <Link to={target.to} activeOptions={{ exact: true }} aria-current={active ? "page" : undefined} {...shared} />
    ) : (
      <button type="button" onClick={target.onClick} {...shared} />
    )

  return (
    <Tooltip>
      <TooltipTrigger render={trigger} delay={TOOLTIP_DELAY_SLOW}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {tooltip ?? label}
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}

export type RailProps = {
  match: PageMatch
  /** Where a service's rail item leads: its last visited section, or its first. */
  serviceHref: (service: Service) => DashboardPath
  onOpenPalette: () => void
  user: ShellUser
  /** Pending reports: a dot on Reports while there are any. */
  pending: PendingCounts
  className?: string
}

const iconProps = { className: "size-5", strokeWidth: 1.75 } as const

/** The accent dot on Reports while reports are open; nothing while loading, at zero or on a failed load. */
export function OpenReportsDot({
  count: countPromise,
  label,
  className,
}: {
  count: Promise<number | null>
  label: string
  className?: string
}) {
  const count = use(useDeferredValue(countPromise))
  if (!count) return null
  return (
    <span
      className={cn(
        "absolute top-1.5 right-1.5 size-2 rounded-full bg-(--pn-accent-solid) shadow-[0_0_0_2px_var(--pn-nav)]",
        className
      )}
    >
      <span className="sr-only">, {label}</span>
    </span>
  )
}

/** The dot on a service with something waiting (open reports, documents to sign). */
export function ServiceDot({
  service,
  pending,
  className,
}: {
  service: ServiceId
  pending: PendingCounts
  className?: string
}) {
  const target = servicePending(service, pending)
  if (!target) return null
  return (
    <Suspense fallback={null}>
      <OpenReportsDot count={target.count} label={target.label} className={className} />
    </Suspense>
  )
}

/** The 64px service rail. One tab stop; ↑/↓, Home and End move between items. */
export function Rail({ match, serviceHref, onOpenPalette, user, pending, className }: RailProps) {
  const panelServices = useVisibleServices().filter((service) => service.sections.length > 0)
  const navRef = useRef<HTMLElement>(null)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const { theme, toggleTheme } = useTheme()
  const modifierKey = useModifierKey()

  const activeId = serviceFor(match).id
  const overview = serviceById("overview")
  const account = serviceById("account")

  // Item order: logo (Overview), search, services…, theme, account.
  const serviceStart = 2
  const themeIndex = serviceStart + panelServices.length
  const accountIndex = themeIndex + 1
  const activeIndex =
    activeId === "overview"
      ? 0
      : activeId === "account"
        ? accountIndex
        : serviceStart + panelServices.findIndex((service) => service.id === activeId)
  const tabStop = focusedIndex ?? activeIndex

  function items() {
    return Array.from(navRef.current?.querySelectorAll<HTMLElement>("[data-rail-item]") ?? [])
  }

  function onFocus(event: FocusEvent<HTMLElement>) {
    const index = items().indexOf(event.target)
    if (index >= 0) setFocusedIndex(index)
  }

  function onBlur(event: FocusEvent<HTMLElement>) {
    if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
      setFocusedIndex(null)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const all = items()
    const current = all.findIndex((item) => item === document.activeElement)
    if (current < 0) return
    let next: number | null = null
    if (event.key === "ArrowDown") next = (current + 1) % all.length
    if (event.key === "ArrowUp") next = (current - 1 + all.length) % all.length
    if (event.key === "Home") next = 0
    if (event.key === "End") next = all.length - 1
    if (event.key === " " && all[current] instanceof HTMLAnchorElement) {
      event.preventDefault()
      all[current].click()
      return
    }
    if (next === null) return
    event.preventDefault()
    all[next]?.focus()
  }

  return (
    <nav
      ref={navRef}
      aria-label="Services"
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className={cn(
        "flex h-full w-16 shrink-0 flex-col items-center gap-1.5 border-r border-(--pn-line) bg-(--pn-nav) py-3.5 select-none",
        className
      )}
    >
      {/* The logo uses the same active fill and left indicator as every other rail item. */}
      <RailItem
        label={overview.title}
        active={activeId === "overview"}
        focusable={tabStop === 0}
        target={{ kind: "link", to: overview.path }}
        className="[&>img]:transition-transform [&>img]:duration-120 [&>img]:ease-(--pn-ease-out) hover:[&>img]:scale-106"
      >
        <img src={logoUrl} alt="" width={32} height={32} className="size-8 rounded-full" />
      </RailItem>

      <RailItem
        label="Search"
        hint={
          <kbd className="rounded-(--pn-r-1) bg-(--pn-bg)/20 px-1 font-sans text-[11px] leading-4">
            {modifierKey === "⌘" ? "⌘K" : "Ctrl K"}
          </kbd>
        }
        active={false}
        focusable={tabStop === 1}
        target={{ kind: "button", onClick: onOpenPalette }}
      >
        <Search {...iconProps} />
      </RailItem>

      <div aria-hidden className="my-1.5 h-px w-6 shrink-0 bg-(--pn-line)" />

      {panelServices.map((service, index) => (
        <RailItem
          key={service.id}
          label={service.title}
          active={activeId === service.id}
          focusable={tabStop === serviceStart + index}
          target={{ kind: "link", to: serviceHref(service) }}
        >
          <ServiceGlyph service={service} className={iconProps.className} />
          <ServiceDot service={service.id} pending={pending} />
        </RailItem>
      ))}

      <div className="flex-1" />

      <RailItem
        label={themeToggleLabel(theme)}
        active={false}
        focusable={tabStop === themeIndex}
        target={{ kind: "button", onClick: toggleTheme }}
        themeToggle
      >
        {/* Both icons render and the theme class picks one, so the server-rendered icon is right before hydration. */}
        <Sun strokeWidth={1.75} className="hidden size-5 dark:block" />
        <Moon strokeWidth={1.75} className="size-5 dark:hidden" />
      </RailItem>

      <RailItem
        label="Account"
        tooltip={user.name || user.email}
        active={activeId === "account"}
        focusable={tabStop === accountIndex}
        target={{ kind: "link", to: account.path }}
      >
        <AccountAvatar user={user} className="size-7.5" />
      </RailItem>
    </nav>
  )
}
