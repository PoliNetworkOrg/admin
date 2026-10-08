import { Outlet } from "@tanstack/react-router"
import { animate, AnimatePresence, motion, type Transition, useReducedMotion } from "motion/react"
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { TOOLTIP_DELAY } from "@/components/primitives/hint"
import { TooltipProvider } from "@/components/ui/tooltip"
import { type AdminSession, useSession } from "@/lib/auth"

import type { ShellUser } from "./account-avatar"
import { CommandPalette } from "./command-palette"
import {
  type DashboardPath,
  isDeepPage,
  matchPath,
  type Service,
  type ServiceId,
  sectionFor,
  serviceFor,
  services,
} from "./nav"
import {
  PageBarContent,
  pageBarFrame,
  servicePanelVisible,
  type ShellFrame,
  ShellFrameContext,
  useRenderedPathname,
} from "./page-bar"
import { Panel } from "./panel"
import { PanelSheet } from "./panel-sheet"
import { Rail } from "./rail"
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts"
import { SignOutProvider, useSignOut } from "./use-sign-out"

const DESKTOP_QUERY = "(min-width: 1024px)"

/**
 * The panel slides in from under the rail when a service page follows Overview/Account and back out the other way;
 * the content column follows with the same transform, so its edge stays locked to the panel's. Exits run faster than
 * enters. Both slides animate `transform` strings, which Motion hands to WAAPI: they start in the commit that
 * mounts the next page and keep running off the main thread while it renders (an `x` or `layout` animation is
 * driven per frame from JS and stalls behind that commit).
 */
const panelEnter: Transition = { duration: 0.22, ease: [0.32, 0.72, 0, 1] }
const panelExit: Transition = { duration: 0.18, ease: [0.32, 0.72, 0, 1] }
/** The panel's `w-56`: how far the column moves. */
const PANEL_WIDTH = 224

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** True at >= 1024px, where the panel is in the layout. */
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

function toShellUser(session: AdminSession | null): ShellUser {
  const user = session?.user
  return { name: user?.name ?? "", email: user?.email ?? "", image: user?.image ?? null }
}

export type DashboardShellProps = {
  /** The session `/dashboard` loaded; the live `useSession` value replaces it once the client has one. */
  initialSession: AdminSession
  /** Pending reports for the Reports › Open count; streams in, null when it couldn't be loaded. */
  pendingReports: Promise<number | null>
}

/**
 * The dashboard frame: rail · panel · column(header bar + scrolling main). Pages render
 * their header content through `PageBar` and their body inside `PageContent`.
 */
export function DashboardShell({ initialSession, pendingReports }: DashboardShellProps) {
  return (
    <SignOutProvider>
      <DashboardFrame initialSession={initialSession} pendingReports={pendingReports} />
    </SignOutProvider>
  )
}

function DashboardFrame({ initialSession, pendingReports }: DashboardShellProps) {
  const pathname = useRenderedPathname()
  const match = matchPath(pathname)
  const service = serviceFor(match)
  const section = sectionFor(match)
  const hasPanel = servicePanelVisible(service)
  const isDesktop = useIsDesktop()
  const serviceHref = useRememberedSections(service, section?.path)

  const sessionQuery = useSession()
  const user = toShellUser(sessionQuery.data ?? initialSession)
  const { signOut } = useSignOut()
  const onSignOut = useCallback(() => void signOut(), [signOut])

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [expandedService, setExpandedService] = useState<ServiceId | null>(null)
  const [main, setMain] = useState<HTMLElement | null>(null)

  const openNavigation = useCallback(() => {
    setExpandedService(hasPanel ? service.id : null)
    setSheetOpen(true)
  }, [hasPanel, service.id])

  const togglePalette = useCallback(() => setPaletteOpen((open) => !open), [])
  const openPalette = useCallback(() => setPaletteOpen(true), [])
  useKeyboardShortcuts(togglePalette)

  if (isDesktop && sheetOpen) setSheetOpen(false)

  function onServiceClick(target: Service, event: MouseEvent<HTMLAnchorElement>) {
    if (isDesktop || target.sections.length < 2) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    setExpandedService(target.id)
    setSheetOpen(true)
  }

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
    const from = `translateX(${offset + (hasPanel ? -PANEL_WIDTH : PANEL_WIDTH)}px)`
    column.style.transform = from
    animate(
      column,
      { transform: [from, "translateX(0px)"], transitionEnd: { transform: "none" } },
      hasPanel ? panelEnter : panelExit
    )
  }, [hasPanel, isDesktop, reduceMotion])

  const frame = useMemo(
    (): ShellFrame => ({ main, setMain, service, section, openNavigation }),
    [main, service, section, openNavigation]
  )

  return (
    <ShellFrameContext.Provider value={frame}>
      <TooltipProvider delay={TOOLTIP_DELAY} closeDelay={0} timeout={300}>
        <div className="relative flex h-dvh overflow-hidden bg-(--pn-bg) text-[14px] leading-5 text-(--pn-fg)">
          <Rail
            match={match}
            serviceHref={serviceHref}
            onServiceClick={onServiceClick}
            onOpenPalette={openPalette}
            user={user}
            className="relative z-10 max-sm:hidden"
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
                className="flex h-full shrink-0 max-lg:hidden"
              >
                <Panel service={service} match={match} pendingReports={pendingReports} />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div
            ref={columnRef}
            className="flex min-w-0 flex-1 flex-col [&:has([data-page-bar])>[data-shell-fallback]]:hidden"
          >
            <header data-shell-fallback="" className={pageBarFrame}>
              <PageBarContent />
            </header>
            {section && !isDeepPage(match) ? <h1 className="sr-only">{section.title}</h1> : null}
            <Outlet />
          </div>

          <PanelSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            expanded={expandedService}
            onExpandedChange={setExpandedService}
            match={match}
            serviceHref={serviceHref}
            onOpenPalette={openPalette}
            user={user}
            pendingReports={pendingReports}
          />
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onSignOut={onSignOut} />
        </div>
      </TooltipProvider>
    </ShellFrameContext.Provider>
  )
}
