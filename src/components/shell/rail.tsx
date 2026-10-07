import { Link } from "@tanstack/react-router"
import { Moon, Search, Sun } from "lucide-react"
import { type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode, useRef, useState } from "react"

import logoUrl from "@/assets/logo.png"
import { TOOLTIP_DELAY_SLOW } from "@/components/primitives/hint"
import { useModifierKey } from "@/components/primitives/use-modifier-key"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { AccountAvatar, type ShellUser } from "./account-avatar"
import { type DashboardPath, type PageMatch, type Service, panelServices, serviceById, serviceFor } from "./nav"
import { ServiceGlyph } from "./service-glyph"
import { themeToggleLabel, useTheme } from "./theme"

const railItemClass =
  "relative grid size-10 shrink-0 place-items-center rounded-(--pn-r-3) text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:bg-(--pn-muted) hover:text-(--pn-fg)"

// The 2px × 20px indicator sits on the rail's left edge: items are inset 8px, hence -left-2.
const railActiveClass =
  "bg-(--pn-accent-soft) text-(--pn-accent) hover:bg-(--pn-accent-soft) hover:text-(--pn-accent) before:absolute before:top-1/2 before:-left-2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-[1px] before:bg-(--pn-accent)"

type RailItemTarget =
  | { kind: "link"; to: DashboardPath; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void }
  | { kind: "button"; onClick: () => void }

type RailItemProps = {
  label: string
  /** Tooltip text when it differs from the accessible label (the account shows the user's name). */
  tooltip?: string
  /** Extra tooltip content after the label, e.g. the ⌘K shortcut. */
  hint?: ReactNode
  active: boolean
  focusable: boolean
  target: RailItemTarget
  className?: string
  children: ReactNode
}

function RailItem({ label, tooltip, hint, active, focusable, target, className, children }: RailItemProps) {
  const shared = {
    "aria-label": label,
    "data-rail-item": "",
    tabIndex: focusable ? 0 : -1,
    className: cn(railItemClass, active && railActiveClass, className),
  }
  const trigger =
    target.kind === "link" ? (
      <Link
        to={target.to}
        onClick={target.onClick}
        activeOptions={{ exact: true }}
        aria-current={active ? "page" : undefined}
        {...shared}
      />
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
  /** Lets the shell open the panel sheet instead of navigating on narrow screens. */
  onServiceClick: (service: Service, event: MouseEvent<HTMLAnchorElement>) => void
  onOpenPalette: () => void
  user: ShellUser
  className?: string
}

const iconProps = { className: "size-5", strokeWidth: 1.75 } as const

/** The 56px service rail (docs/design.md §2.1). One tab stop; ↑/↓, Home and End move between items. */
export function Rail({ match, serviceHref, onServiceClick, onOpenPalette, user, className }: RailProps) {
  const navRef = useRef<HTMLElement>(null)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const { theme, toggleTheme } = useTheme()
  const modifierKey = useModifierKey()

  const activeId = serviceFor(match).id
  const overview = serviceById("overview")
  const account = serviceById("account")

  // Item order: logo, overview, search, services…, theme, account.
  const serviceStart = 3
  const themeIndex = serviceStart + panelServices.length
  const accountIndex = themeIndex + 1
  const activeIndex =
    activeId === "overview"
      ? 1
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
        "flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r border-(--pn-line) bg-(--pn-nav) py-2",
        className
      )}
    >
      <RailItem
        label="PoliNetwork Admin — Overview"
        active={false}
        focusable={tabStop === 0}
        target={{ kind: "link", to: overview.path }}
        className="mb-1"
      >
        <img src={logoUrl} alt="" width={28} height={28} className="size-7 rounded-full" />
      </RailItem>

      <RailItem
        label={overview.title}
        active={activeId === "overview"}
        focusable={tabStop === 1}
        target={{ kind: "link", to: overview.path }}
      >
        <overview.icon {...iconProps} />
      </RailItem>

      <RailItem
        label="Search"
        hint={
          <kbd className="rounded-(--pn-r-1) bg-(--pn-bg)/20 px-1 font-sans text-[11px] leading-4">
            {modifierKey === "⌘" ? "⌘K" : "Ctrl K"}
          </kbd>
        }
        active={false}
        focusable={tabStop === 2}
        target={{ kind: "button", onClick: onOpenPalette }}
      >
        <Search {...iconProps} />
      </RailItem>

      <div aria-hidden className="my-1 h-px w-6 shrink-0 bg-(--pn-line)" />

      {panelServices.map((service, index) => (
        <RailItem
          key={service.id}
          label={service.title}
          active={activeId === service.id}
          focusable={tabStop === serviceStart + index}
          target={{ kind: "link", to: serviceHref(service), onClick: (event) => onServiceClick(service, event) }}
        >
          <ServiceGlyph service={service} className="size-5" />
        </RailItem>
      ))}

      <div className="flex-1" />

      <RailItem
        label={themeToggleLabel(theme)}
        active={false}
        focusable={tabStop === themeIndex}
        target={{ kind: "button", onClick: toggleTheme }}
      >
        {theme === "dark" ? <Sun {...iconProps} /> : <Moon {...iconProps} />}
      </RailItem>

      <RailItem
        label="Account"
        tooltip={user.name || user.email}
        active={activeId === "account"}
        focusable={tabStop === accountIndex}
        target={{ kind: "link", to: account.path }}
      >
        <AccountAvatar user={user} />
      </RailItem>
    </nav>
  )
}
