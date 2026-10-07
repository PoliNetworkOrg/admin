import { Link } from "@tanstack/react-router"
import { ChevronDown, ChevronRight, Moon, Search, Sun, X } from "lucide-react"
import type { ReactNode } from "react"

import logoUrl from "@/assets/logo.png"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

import { AccountAvatar, type ShellUser } from "./account-avatar"
import {
  type DashboardPath,
  type PageMatch,
  type Service,
  type ServiceId,
  panelServices,
  serviceById,
  serviceFor,
} from "./nav"
import { onSectionListKeyDown, SectionItems } from "./panel"
import { ServiceGlyph } from "./service-glyph"
import { themeToggleLabel, useTheme } from "./theme"

const rowClass =
  "flex h-14 w-full items-center gap-3 rounded-(--pn-r-3) px-3 text-left text-[14px] font-medium text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:bg-(--pn-muted) hover:text-(--pn-fg)"
const rowCurrentClass = "text-(--pn-fg) [&>svg:first-child]:text-(--pn-accent)"
const glyphClass = "size-5 shrink-0"

export type PanelSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The service listed with its sections underneath; the rail sets it when it opens the sheet. */
  expanded: ServiceId | null
  onExpandedChange: (service: ServiceId | null) => void
  match: PageMatch
  serviceHref: (service: Service) => DashboardPath
  onOpenPalette: () => void
  user: ShellUser
  pendingReports: Promise<number | null>
}

/**
 * Navigation below 1024px (docs/design.md §2.2): the services as 56px rows, the expanded one showing its
 * sections. Below 640px the rail is gone too, so Overview, Search, Theme and Account join the list.
 */
export function PanelSheet({
  open,
  onOpenChange,
  expanded,
  onExpandedChange,
  match,
  serviceHref,
  onOpenPalette,
  user,
  pendingReports,
}: PanelSheetProps) {
  const { theme, toggleTheme } = useTheme()
  const currentId = serviceFor(match).id
  const close = () => onOpenChange(false)
  const overview = serviceById("overview")
  const account = serviceById("account")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="gap-0 rounded-r-(--pn-r-5) border-(--pn-line) bg-(--pn-surface-raised) p-0 text-(--pn-fg) transition-transform duration-200 ease-(--pn-ease-out) data-ending-style:opacity-100 data-ending-style:duration-150 data-ending-style:ease-(--pn-ease-in) data-starting-style:opacity-100 data-[side=left]:w-70 data-[side=left]:data-ending-style:-translate-x-full data-[side=left]:data-starting-style:-translate-x-full data-[side=left]:sm:max-w-none"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-13 shrink-0 items-center justify-between border-b border-(--pn-line) pr-2 pl-4">
          <Link
            to={overview.path}
            onClick={close}
            aria-label="PoliNetwork Admin — Overview"
            className="flex items-center gap-2 rounded-(--pn-r-2) text-[14px] font-semibold"
          >
            <img src={logoUrl} alt="" width={28} height={28} className="size-7 rounded-full" />
            PoliNetwork Admin
          </Link>
          <SheetClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close navigation"
                className="text-(--pn-fg-muted) hover:text-(--pn-fg)"
              />
            }
          >
            <X />
          </SheetClose>
        </div>

        <nav aria-label="Services" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {panelServices.map((service) => {
            const current = service.id === currentId
            if (service.sections.length === 1) {
              return (
                <Link
                  key={service.id}
                  to={serviceHref(service)}
                  onClick={close}
                  aria-current={current ? "page" : undefined}
                  className={cn(rowClass, current && rowCurrentClass)}
                >
                  <ServiceGlyph service={service} className={glyphClass} />
                  {service.title}
                </Link>
              )
            }
            const isExpanded = service.id === expanded
            const Chevron = isExpanded ? ChevronDown : ChevronRight
            return (
              <div key={service.id} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => onExpandedChange(isExpanded ? null : service.id)}
                  className={cn(rowClass, current && rowCurrentClass)}
                >
                  <ServiceGlyph service={service} className={glyphClass} />
                  <span className="flex-1">{service.title}</span>
                  <Chevron aria-hidden className="size-4 text-(--pn-fg-muted)" />
                </button>
                {isExpanded ? (
                  <div
                    role="group"
                    aria-label={`${service.title} sections`}
                    onKeyDown={onSectionListKeyDown}
                    className="flex flex-col gap-0.5 pb-2 pl-8"
                  >
                    <SectionItems service={service} match={match} pendingReports={pendingReports} onNavigate={close} />
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>

        <div className="flex shrink-0 flex-col gap-0.5 border-t border-(--pn-line) p-2 sm:hidden">
          <SheetRow current={currentId === "overview"} to={overview.path} onNavigate={close}>
            <overview.icon aria-hidden className={glyphClass} strokeWidth={1.75} />
            {overview.title}
          </SheetRow>
          <button
            type="button"
            className={rowClass}
            onClick={() => {
              close()
              onOpenPalette()
            }}
          >
            <Search aria-hidden className={glyphClass} strokeWidth={1.75} />
            Search
          </button>
          <button type="button" className={rowClass} onClick={toggleTheme}>
            {theme === "dark" ? (
              <Sun aria-hidden className={glyphClass} strokeWidth={1.75} />
            ) : (
              <Moon aria-hidden className={glyphClass} strokeWidth={1.75} />
            )}
            {themeToggleLabel(theme)}
          </button>
          <SheetRow current={currentId === "account"} to={account.path} onNavigate={close}>
            <AccountAvatar user={user} className="mx-[-4px]" />
            {account.title}
          </SheetRow>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SheetRow({
  current,
  to,
  onNavigate,
  children,
}: {
  current: boolean
  to: DashboardPath
  onNavigate: () => void
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={cn(rowClass, current && rowCurrentClass)}
    >
      {children}
    </Link>
  )
}
