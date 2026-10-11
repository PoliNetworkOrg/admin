import { Outlet } from "@tanstack/react-router"
import { animate, AnimatePresence, motion, type Transition, useReducedMotion } from "motion/react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"

import { TOOLTIP_DELAY } from "@/components/primitives/hint"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { DashboardUser } from "@/lib/auth"

import type { ShellUser } from "./account-avatar"
import { CommandPalette } from "./command-palette"
import { MobileBottomNav, MobileTopBar } from "./mobile-nav"
import { type DashboardPath, matchPath, type Service, type ServiceId, sectionFor, serviceFor, services } from "./nav"
import { servicePanelVisible, type ShellFrame, ShellFrameContext, useRenderedPathname } from "./page-bar"
import { Panel, SectionPills } from "./panel"
import { Rail } from "./rail"
import { useVisibleServices } from "./use-can"
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts"
import { SignOutProvider, useSignOut } from "./use-sign-out"

/** The shell's breakpoint (`shell:` in Tailwind): rail and panel from here, top bar, pills and bottom nav below. */
const DESKTOP_QUERY = "(min-width: 760px)"

/**
 * The panel slides in from under the rail when a service page follows Overview/Account and back out the other way;
 * the content column follows with the same transform, so its edge stays locked to the panel's. Exits run faster than
 * enters. Both slides animate `transform` strings, which Motion hands to WAAPI: they start in the commit that
 * mounts the next page and keep running off the main thread while it renders (an `x` or `layout` animation is
 * driven per frame from JS and stalls behind that commit).
 */
const panelEnter: Transition = { duration: 0.22, ease: [0.32, 0.72, 0, 1] }
const panelExit: Transition = { duration: 0.18, ease: [0.32, 0.72, 0, 1] }
/** The panel's width (`w-60`, `w-50` below 1100px): how far the column moves. */
function panelWidth() {
  return window.matchMedia("(max-width: 1100px)").matches ? 200 : 240
}

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** True at >= 760px, where the rail and panel are in the layout. */
function useIsDesktop() {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true
  )
}

const sectionMemoryKey = (id: ServiceId) => `polinetwork-last-section:${id}`

/**
 * The last section visited per service this session, so the rail returns to it. Read after hydration: the
 * server renders every service's first section.
 */
function useRememberedSections(service: Service, sectionPath: DashboardPath | undefined) {
  const [remembered, setRemembered] = useState<ReadonlyMap<ServiceId, string>>(new Map())

  useEffect(() => {
    if (sectionPath) window.sessionStorage.setItem(sectionMemoryKey(service.id), sectionPath)
    const next = new Map<ServiceId, string>()
    for (const candidate of services) {
      const path = window.sessionStorage.getItem(sectionMemoryKey(candidate.id))
      if (path !== null) next.set(candidate.id, path)
    }
    setRemembered(next)
  }, [service.id, sectionPath])

  return useCallback(
    (target: Service) =>
      target.sections.find((section) => section.path === remembered.get(target.id))?.path ?? target.path,
    [remembered]
  )
}

function toShellUser(user: DashboardUser): ShellUser {
  return { name: user.name, email: user.email, image: user.picture }
}

export type DashboardShellProps = {
  /** The signed-in user `/dashboard` loaded: ID-token claims. */
  user: DashboardUser
  /** Pending reports for the Reports dot and the Reports › Open count; streams in, null when it couldn't be loaded. */
  pendingReports: Promise<number | null>
}

/**
 * The dashboard frame. From 760px: rail · panel · scrolling column. Below: top bar, then the scrolling column (the
 * service's section pills, then the page), then the bottom nav. Pages render their header through `PageBar` and
 * their body inside `PageContent`; both scroll with the page.
 */
export function DashboardShell({ user, pendingReports }: DashboardShellProps) {
  return (
    <SignOutProvider>
      <DashboardFrame user={user} pendingReports={pendingReports} />
    </SignOutProvider>
  )
}

function DashboardFrame({ user: dashboardUser, pendingReports }: DashboardShellProps) {
  const pathname = useRenderedPathname()
  const match = matchPath(pathname)
  const rawService = serviceFor(match)
  const service = useVisibleServices().find((candidate) => candidate.id === rawService.id) ?? rawService
  const section = sectionFor(match)
  const hasPanel = servicePanelVisible(service)
  const isDesktop = useIsDesktop()
  const serviceHref = useRememberedSections(service, section?.path)

  const user = toShellUser(dashboardUser)
  const { signOut } = useSignOut()
  const onSignOut = useCallback(() => signOut(), [signOut])

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [main, setMain] = useState<HTMLElement | null>(null)

  const togglePalette = useCallback(() => setPaletteOpen((open) => !open), [])
  const openPalette = useCallback(() => setPaletteOpen(true), [])
  useKeyboardShortcuts(togglePalette)

  const reduceMotion = useReducedMotion()

  // The column is laid out at its new place already: start it where it was drawn (mid-slide too) and slide home.
  // The start is set inline first so the commit's paint never shows it at the end.
  const columnRef = useRef<HTMLDivElement>(null)
  const columnHadPanel = useRef(hasPanel)
  useLayoutEffect(() => {
    const column = columnRef.current
    if (!column || columnHadPanel.current === hasPanel) return
    columnHadPanel.current = hasPanel
    if (reduceMotion || !isDesktop) return
    const offset = new DOMMatrixReadOnly(getComputedStyle(column).transform).m41
    const width = panelWidth()
    const from = `translateX(${offset + (hasPanel ? -width : width)}px)`
    column.style.transform = from
    animate(
      column,
      { transform: [from, "translateX(0px)"], transitionEnd: { transform: "none" } },
      hasPanel ? panelEnter : panelExit
    )
  }, [hasPanel, isDesktop, reduceMotion])

  const frame = useMemo(
    (): ShellFrame => ({ main, setMain, service, section, serviceHref, openPalette }),
    [main, service, section, serviceHref, openPalette]
  )

  return (
    <ShellFrameContext.Provider value={frame}>
      <TooltipProvider delay={TOOLTIP_DELAY} closeDelay={0} timeout={300}>
        <div className="relative flex h-dvh overflow-hidden bg-(--pn-bg) text-[14px] leading-5 text-(--pn-fg)">
          <Rail
            match={match}
            serviceHref={serviceHref}
            onOpenPalette={openPalette}
            user={user}
            pendingReports={pendingReports}
            className="relative z-10 max-shell:hidden"
          />
          {/* No entrance on first paint; `popLayout` lifts the leaving panel out of the flow at once. The leaving panel
              keeps the props it last rendered with, so `exit` names its own transition. */}
          <AnimatePresence initial={false} mode="popLayout">
            {hasPanel ? (
              <motion.div
                key="panel"
                initial={reduceMotion ? false : { transform: "translateX(-100%)" }}
                animate={{
                  transform: "translateX(0%)",
                  transitionEnd: { transform: "none" },
                  transition: reduceMotion ? { duration: 0 } : panelEnter,
                }}
                exit={{ transform: "translateX(-100%)", transition: reduceMotion ? { duration: 0 } : panelExit }}
                className="flex h-full shrink-0 max-shell:hidden"
              >
                <Panel service={service} match={match} pendingReports={pendingReports} />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div ref={columnRef} className="flex min-w-0 flex-1 flex-col">
            <MobileTopBar match={match} onOpenPalette={openPalette} user={user} className="shell:hidden" />
            {/* One scroll container per page: keyed so each page starts at the top, and back/forward restore it. */}
            <div
              key={pathname}
              ref={setMain}
              data-scroll-restoration-id={`dashboard-main:${pathname}`}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
            >
              {hasPanel ? (
                <SectionPills
                  service={service}
                  match={match}
                  pendingReports={pendingReports}
                  className="shell:hidden"
                />
              ) : null}
              <main className="flex min-h-full flex-col">
                <Outlet />
              </main>
            </div>
            <MobileBottomNav
              match={match}
              serviceHref={serviceHref}
              pendingReports={pendingReports}
              className="shell:hidden"
            />
          </div>

          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onSignOut={onSignOut} />
        </div>
      </TooltipProvider>
    </ShellFrameContext.Provider>
  )
}
