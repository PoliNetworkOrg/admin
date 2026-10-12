import { Link } from "@tanstack/react-router"
import { type KeyboardEvent, Suspense, use, useDeferredValue, useLayoutEffect, useRef } from "react"

import { cn } from "@/lib/utils"

import { type PageMatch, type Section, type Service, isDeepPage, sectionFor } from "./nav"
import { ServiceGlyph } from "./service-glyph"

const itemClass =
  "relative flex h-9.5 items-center gap-2.5 rounded-(--pn-r-3) px-2.5 text-[14px] font-medium text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:bg-(--pn-hover) hover:text-(--pn-fg)"

// Active and ancestor share the fill and the accent icon; only the current page gets the indicator on the panel's
// left edge (items are inset 12px, hence -left-3).
const itemActiveClass = "bg-(--pn-nav-active) text-(--pn-fg) hover:bg-(--pn-nav-active)"
const itemCurrentClass =
  "before:absolute before:inset-y-2.5 before:-left-3 before:w-[3px] before:rounded-r-[3px] before:bg-(--pn-accent-solid)"

/** Pending reports as a small accent pill next to Reports › Open; zero (or a failed load) renders nothing. */
function PendingReportsCount({ count: countPromise }: { count: Promise<number | null> }) {
  const count = use(useDeferredValue(countPromise))
  if (!count) return null
  return (
    <span className="ml-auto rounded-full bg-(--pn-accent-soft) px-1.75 font-mono text-[11px] leading-4.5 font-medium text-(--pn-accent) tabular-nums">
      <span className="sr-only">, </span>
      {count}
      <span className="sr-only"> pending</span>
    </span>
  )
}

/** ↑/↓ (and ←/→ for the horizontal pills) move between the links of a section list; Tab still walks them in order. */
export function onSectionListKeyDown(event: KeyboardEvent<HTMLElement>) {
  const forward = event.key === "ArrowDown" || event.key === "ArrowRight"
  const backward = event.key === "ArrowUp" || event.key === "ArrowLeft"
  if (!forward && !backward) return
  const links = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a[data-section-item]"))
  const current = links.findIndex((link) => link === document.activeElement)
  if (current < 0) return
  event.preventDefault()
  const next = forward ? (current + 1) % links.length : (current - 1 + links.length) % links.length
  links[next]?.focus()
}

export type SectionItemsProps = {
  service: Service
  match: PageMatch
  /** Streams in from the `/dashboard` loader; resolves to null when the reports couldn't be loaded. */
  pendingReports: Promise<number | null>
  /** `panel` for the desktop list, `pills` for the horizontally scrolling row under the mobile top bar. */
  variant?: "panel" | "pills"
}

const pillClass =
  "inline-flex h-9 shrink-0 items-center gap-1.75 rounded-full border border-(--pn-line) bg-(--pn-surface) px-3 text-[13px] font-medium whitespace-nowrap text-(--pn-fg-muted) transition-[background-color,color,border-color] duration-120 hover:text-(--pn-fg)"
const pillActiveClass =
  "border-[color-mix(in_oklab,var(--pn-accent)_45%,transparent)] bg-(--pn-accent-soft) text-(--pn-accent) hover:text-(--pn-accent)"

/** The section links of one service; shared by the panel and the mobile section pills. */
export function SectionItems({ service, match, pendingReports, variant = "panel" }: SectionItemsProps) {
  const current = sectionFor(match)
  const deep = isDeepPage(match)
  const pills = variant === "pills"
  return service.sections.map((section: Section) => {
    const active = current?.path === section.path
    return (
      <Link
        key={section.id}
        to={section.path}
        activeOptions={{ exact: true }}
        data-section-item=""
        aria-current={active && !deep ? "page" : undefined}
        data-ancestor={active && deep ? "" : undefined}
        className={
          pills
            ? cn(pillClass, active && pillActiveClass)
            : cn(itemClass, active && itemActiveClass, active && !deep && itemCurrentClass)
        }
      >
        <section.icon
          aria-hidden
          strokeWidth={1.75}
          className={cn(
            "shrink-0",
            pills ? "size-4" : "size-4.5",
            active ? "text-(--pn-accent)" : pills ? "text-current" : "text-(--pn-fg-muted)"
          )}
        />
        <span className="truncate">{section.title}</span>
        {service.id === "reports" && section.id === "open" ? (
          <Suspense fallback={null}>
            <PendingReportsCount count={pendingReports} />
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

/** The 240px section panel (200px below 1100px). States the service name once, in its header. */
export function Panel({ service, match, pendingReports, className }: PanelProps) {
  return (
    <aside
      data-shell-panel=""
      className={cn(
        "flex h-full w-60 shrink-0 flex-col border-r border-(--pn-line) bg-(--pn-panel) select-none max-[1100px]:w-50",
        className
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-(--pn-line) px-5.5">
        <ServiceGlyph service={service} className="size-4.5 text-(--pn-fg)" />
        <span className="truncate text-[15px] font-semibold text-(--pn-fg)">{service.title}</span>
      </div>
      <nav
        aria-label={`${service.title} sections`}
        onKeyDown={onSectionListKeyDown}
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3"
      >
        <SectionItems service={service} match={match} pendingReports={pendingReports} />
      </nav>
    </aside>
  )
}

/** Below 760px: the service's sections as a horizontally scrolling row of pills under the top bar. */
export function SectionPills({ service, match, pendingReports, className }: PanelProps) {
  const ref = useRef<HTMLElement>(null)
  const currentPath = sectionFor(match)?.path
  // Keep the current pill in view: a section past the screen edge would otherwise look unselected. Re-run when the
  // section changes (the shell stays mounted between sections) and once the web font has settled the pill widths.
  useLayoutEffect(() => {
    const nav = ref.current
    if (!nav) return
    const reveal = () => {
      const current = nav.querySelector<HTMLElement>("[aria-current=page], [data-ancestor]")
      if (!current) return
      const start = current.offsetLeft - 16
      const end = current.offsetLeft + current.offsetWidth + 16 - nav.clientWidth
      if (nav.scrollLeft > start) nav.scrollLeft = start
      else if (nav.scrollLeft < end) nav.scrollLeft = end
    }
    reveal()
    let live = true
    void document.fonts?.ready.then(() => live && reveal())
    return () => {
      live = false
    }
  }, [currentPath])
  return (
    <nav
      ref={ref}
      aria-label={`${service.title} sections`}
      onKeyDown={onSectionListKeyDown}
      className={cn(
        "relative flex gap-1.5 overflow-x-auto border-b border-(--pn-line) bg-(--pn-panel) px-4 py-2.5 [scrollbar-width:none]",
        className
      )}
    >
      <SectionItems service={service} match={match} pendingReports={pendingReports} variant="pills" />
    </nav>
  )
}
