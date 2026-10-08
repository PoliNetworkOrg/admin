import { Link } from "@tanstack/react-router"
import { type KeyboardEvent, Suspense, use, useDeferredValue } from "react"

import { cn } from "@/lib/utils"

import { type PageMatch, type Section, type Service, isDeepPage, sectionFor } from "./nav"
import { ServiceGlyph } from "./service-glyph"

const itemClass =
  "relative flex h-8 items-center gap-2 rounded-(--pn-r-2) px-2.5 text-[13px] font-medium text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:bg-(--pn-muted) hover:text-(--pn-fg)"

// Active and ancestor share the visual: the indicator sits at the item's left inner edge.
const itemActiveClass =
  "bg-(--pn-nav-active) text-(--pn-fg) hover:bg-(--pn-nav-active) before:absolute before:top-1/2 before:left-0 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-[1px] before:bg-(--pn-accent)"

/** Pending reports, shown next to Reports › Open; zero (or a failed load) renders nothing. */
function PendingReportsCount({ count: countPromise }: { count: Promise<number | null> }) {
  const count = use(countPromise)
  if (!count) return null
  return (
    <span className="ml-auto text-xs text-(--pn-fg-muted) tabular-nums">
      <span className="sr-only">, </span>
      {count}
      <span className="sr-only"> pending</span>
    </span>
  )
}

/** ↑/↓ move between the links of a section list (Tab still walks them in order). */
export function onSectionListKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
  const links = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a[data-section-item]"))
  const current = links.findIndex((link) => link === document.activeElement)
  if (current < 0) return
  event.preventDefault()
  const next = event.key === "ArrowDown" ? (current + 1) % links.length : (current - 1 + links.length) % links.length
  links[next]?.focus()
}

export type SectionItemsProps = {
  service: Service
  match: PageMatch
  /** Streams in from the `/dashboard` loader; resolves to null when the reports couldn't be loaded. */
  pendingReports: Promise<number | null>
  onNavigate?: () => void
}

/** The section links of one service; shared by the panel and the narrow-screen sheet. */
export function SectionItems({ service, match, pendingReports, onNavigate }: SectionItemsProps) {
  const current = sectionFor(match)
  const deep = isDeepPage(match)
  const count = useDeferredValue(pendingReports)
  return service.sections.map((section: Section) => {
    const active = current?.path === section.path
    return (
      <Link
        key={section.id}
        to={section.path}
        activeOptions={{ exact: true }}
        onClick={onNavigate}
        data-section-item=""
        aria-current={active && !deep ? "page" : undefined}
        data-ancestor={active && deep ? "" : undefined}
        className={cn(itemClass, active && itemActiveClass)}
      >
        <section.icon
          aria-hidden
          className={cn("size-4 shrink-0", active ? "text-(--pn-accent)" : "text-(--pn-fg-muted)")}
        />
        <span className="truncate">{section.title}</span>
        {service.id === "reports" && section.id === "open" ? (
          <Suspense fallback={null}>
            <PendingReportsCount count={count} />
          </Suspense>
        ) : null}
      </Link>
    )
  })
}

export type PanelProps = {
  service: Service
  match: PageMatch
  pendingReports: Promise<number | null>
  className?: string
}

/** The 224px section panel. States the service name once, in its header. */
export function Panel({ service, match, pendingReports, className }: PanelProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-56 shrink-0 flex-col border-r border-(--pn-line) bg-(--pn-nav) select-none",
        className
      )}
    >
      <div className="flex h-13 shrink-0 items-center gap-2 border-b border-(--pn-line) px-4">
        <ServiceGlyph service={service} className="size-4 text-(--pn-fg-muted)" />
        <span className="truncate text-[14px] font-semibold text-(--pn-fg)">{service.title}</span>
      </div>
      <nav
        aria-label={`${service.title} sections`}
        onKeyDown={onSectionListKeyDown}
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2"
      >
        <SectionItems service={service} match={match} pendingReports={pendingReports} />
      </nav>
    </aside>
  )
}
