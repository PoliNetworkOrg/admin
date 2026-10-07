import { type AnyRouter, Link, type RegisteredRouter, type ValidateLinkOptions } from "@tanstack/react-router"
import { ArrowLeft, PanelLeft, Search, X } from "lucide-react"
import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react"
import { createPortal } from "react-dom"

import { Button, buttonVariants } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { Section, Service } from "./nav"

/** Content widths per template (docs/design.md §2.4). The header bar follows the same width. */
export type ContentWidth = "wide" | "tree" | "record" | "settings" | "overview"

const widthClass = {
  wide: "max-w-[1280px]",
  tree: "max-w-[960px]",
  record: "max-w-[1040px]",
  settings: "max-w-[720px]",
  overview: "max-w-[1040px]",
} satisfies Record<ContentWidth, string>

export type ShellFrame = {
  /** The header bar element `PageBar` portals into. */
  header: HTMLElement | null
  /** The scroll container, used as the IntersectionObserver root by `ScrollTitle`. */
  main: HTMLElement | null
  service: Service
  section: Section | null
  width: ContentWidth
  setWidth: (width: ContentWidth) => void
  openNavigation: () => void
  /** Returns the unregister function; the shell renders a bare bar while no page has registered one. */
  registerPageBar: () => () => void
}

export const ShellFrameContext = createContext<ShellFrame | null>(null)

/** Whether the caller renders inside `DashboardShell` (e.g. an error boundary below `/dashboard`). */
export function useInShell() {
  return useContext(ShellFrameContext) !== null
}

function useShellFrame() {
  const frame = useContext(ShellFrameContext)
  if (!frame) throw new Error("PageBar and PageContent must be rendered inside DashboardShell.")
  return frame
}

/** Centers the page content at the template width with the shell's side padding (§2.4). */
export function PageContent({ width = "wide", children }: { width?: ContentWidth; children: ReactNode }) {
  const { setWidth } = useShellFrame()
  useLayoutEffect(() => {
    setWidth(width)
    return () => setWidth("wide")
  }, [setWidth, width])

  return (
    <div className={cn("px-6 pb-12 min-[1440px]:px-8", width === "settings" ? "pt-8" : "pt-6")}>
      <div className={cn("mx-auto w-full", widthClass[width])}>{children}</div>
    </div>
  )
}

/**
 * Where a deep page's back button leads. `label` is the parent in lower case ("users"); `link` takes the same
 * options as TanStack's `Link`: `{ to: "/dashboard/telegram/users" }`, or a parent category with `params`.
 */
export type PageBarBack<TRouter extends AnyRouter = RegisteredRouter, TOptions = unknown> = {
  label: string
  link: ValidateLinkOptions<TRouter, TOptions>
}

export type PageBarProps<TRouter extends AnyRouter = RegisteredRouter, TOptions = unknown> = {
  /** Section pages: the `Toolbar`. On `< 1024px` it moves to a second row. */
  left?: ReactNode
  /** One primary action, plus at most one `outline` secondary; the primary goes last. */
  right?: ReactNode
  /** Pages without a panel (Overview, Account): the visible `h1`. */
  title?: string
  /** Deep pages: the icon-only back button. */
  back?: PageBarBack<TRouter, TOptions>
  /** Deep pages: the parent identifier shown after the back button. */
  context?: ReactNode
  /** Render `context` in DM Mono, for identifiers like Telegram IDs. */
  contextMono?: boolean
  /** Deep pages: the content `h1`; its text fades into the bar once it scrolls out of view. */
  scrollTitleRef?: RefObject<HTMLElement | null>
  /** Text for the scroll title; defaults to the observed element's text. */
  scrollTitle?: string
}

const barRow = "h-[51px]"
const titleText = "truncate text-[15px]/[22px] font-semibold tracking-[-0.005em] text-(--pn-fg)"

/** The 52px header bar above `main`. Render one per page, anywhere in the page; it portals into the shell. */
export function PageBar<TRouter extends AnyRouter = RegisteredRouter, TOptions = unknown>(
  props: PageBarProps<TRouter, TOptions>
): ReactNode
export function PageBar(props: PageBarProps) {
  const { header, registerPageBar } = useShellFrame()
  useLayoutEffect(() => registerPageBar(), [registerPageBar])
  if (!header) return null
  return createPortal(<PageBarContent {...props} />, header)
}

/** Also rendered by the shell itself while the page has no `PageBar`, so the navigation toggle stays reachable. */
export function PageBarContent({
  left,
  right,
  title,
  back,
  context,
  contextMono = false,
  scrollTitleRef,
  scrollTitle,
}: PageBarProps) {
  const { service, section, width } = useShellFrame()
  const actions = right ? <div className="flex items-center justify-end gap-2">{right}</div> : null

  let bar: ReactNode
  if (back) {
    bar = (
      <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4", barRow)}>
        <div className="flex min-w-0 items-center gap-2">
          <NavigationToggle className="lg:hidden" />
          <BackButton {...back} />
          {context ? (
            <span className={cn("truncate text-[13px] text-(--pn-fg-muted)", contextMono && "font-mono")}>
              {context}
            </span>
          ) : null}
          {scrollTitleRef ? <ScrollTitle targetRef={scrollTitleRef} title={scrollTitle} /> : null}
        </div>
        {actions}
      </div>
    )
  } else if (title !== undefined) {
    bar = (
      <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4", barRow)}>
        <div className="flex min-w-0 items-center gap-2">
          {/* Overview and Account have no panel; the rail is the navigation until it hides below 640px. */}
          <NavigationToggle className={section ? "lg:hidden" : "sm:hidden"} />
          <h1 className={titleText}>{title}</h1>
        </div>
        {actions}
      </div>
    )
  } else {
    // Section page: one row at >= 1024 (toolbar | actions); below, "{Service} › {Section}" and actions on
    // row 1 (the panel that names both is hidden) and the toolbar alone on row 2.
    bar = (
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 [grid-template-areas:'lead_right'_'tool_tool'] lg:[grid-template-areas:'tool_right']">
        <div className={cn("flex min-w-0 items-center gap-2 [grid-area:lead] lg:hidden", barRow)}>
          <NavigationToggle className="lg:hidden" />
          {section ? (
            <span aria-hidden className={titleText}>
              {service.title} › {section.title}
            </span>
          ) : null}
        </div>
        {left ? <div className="flex h-11 min-w-0 items-center [grid-area:tool] lg:h-[51px]">{left}</div> : null}
        {actions ? <div className={cn("flex items-center [grid-area:right]", barRow)}>{actions}</div> : null}
      </div>
    )
  }

  return (
    <div className="px-6 min-[1440px]:px-8">
      <div className={cn("mx-auto w-full", widthClass[width])}>{bar}</div>
    </div>
  )
}

/** Opens the navigation sheet; `className` sets the breakpoint it hides from (`lg:hidden` / `sm:hidden`). */
function NavigationToggle({ className }: { className: string }) {
  const { openNavigation } = useShellFrame()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("-ml-2 text-(--pn-fg-muted) hover:text-(--pn-fg)", className)}
            aria-label="Open navigation"
            onClick={openNavigation}
          />
        }
      >
        <PanelLeft />
      </TooltipTrigger>
      <TooltipContent side="bottom">Open navigation</TooltipContent>
    </Tooltip>
  )
}

export function BackButton<TRouter extends AnyRouter = RegisteredRouter, TOptions = unknown>(
  props: PageBarBack<TRouter, TOptions>
): ReactNode
export function BackButton({ label, link }: PageBarBack) {
  const text = `Back to ${label}`
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            {...link}
            aria-label={text}
            data-slot="button"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "-ml-2 text-(--pn-fg-muted) hover:text-(--pn-fg) active:translate-y-0 max-lg:ml-0"
            )}
          />
        }
      >
        <ArrowLeft className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="bottom">{text}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Fades the record name into the header bar once the content `h1` has scrolled above the top of `main`
 * (docs/design.md §1.5). The bar sits outside the scroller, so the observer needs no root margin.
 */
export function ScrollTitle({ targetRef, title }: { targetRef: RefObject<HTMLElement | null>; title?: string }) {
  const { main } = useShellFrame()
  const [scrolledPast, setScrolledPast] = useState(false)
  const [observedText, setObservedText] = useState("")

  useEffect(() => {
    const target = targetRef.current
    if (!target || !main) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        const rootTop = entry.rootBounds?.top ?? 0
        setScrolledPast(!entry.isIntersecting && entry.boundingClientRect.bottom <= rootTop)
        setObservedText(target.textContent ?? "")
      },
      { root: main, threshold: 0 }
    )
    observer.observe(target)
    return () => observer.disconnect()
    // `title` is a dependency so the observer attaches once a loading page renders its h1.
  }, [targetRef, main, title])

  return (
    <span
      aria-hidden
      data-visible={scrolledPast}
      className="flex min-w-0 translate-y-1 items-center gap-2 opacity-0 transition-[opacity,translate] duration-100 ease-(--pn-ease-in) data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100 data-[visible=true]:duration-150 data-[visible=true]:ease-(--pn-ease-out)"
    >
      <span className="h-4 w-px shrink-0 bg-(--pn-line-strong)" />
      <span className="truncate text-[13px] font-medium text-(--pn-fg)">{title ?? observedText}</span>
    </span>
  )
}

export type CountPart = { value: number; total?: number; noun: string; plural?: string }
export type CountProps = CountPart & { parts?: CountPart[]; className?: string }

const numberFormat = new Intl.NumberFormat("en-GB")
const pluralRules = new Intl.PluralRules("en-GB")

function pluralize(noun: string, plural: string | undefined, count: number) {
  if (pluralRules.select(count) === "one") return noun
  if (plural !== undefined) return plural
  if (/[^aeiou]y$/i.test(noun)) return `${noun.slice(0, -1)}ies`
  if (/(s|x|z|ch|sh)$/i.test(noun)) return `${noun}es`
  return `${noun}s`
}

function formatCountPart({ value, total, noun, plural }: CountPart) {
  if (total === undefined) return `${numberFormat.format(value)} ${pluralize(noun, plural, value)}`
  return `${numberFormat.format(value)} of ${numberFormat.format(total)} ${pluralize(noun, plural, total)}`
}

/**
 * "{n} {noun}" or "{n} of {total} {noun}", pluralized with Intl.PluralRules; `parts` append
 * " · {n} {noun}" segments (§8.5). Pass the singular noun: `<Count value={42} noun="group" />`.
 */
export function Count({ parts = [], className, ...first }: CountProps) {
  const text = [first, ...parts].map(formatCountPart).join(" · ")
  return (
    <span
      aria-live="polite"
      className={cn("shrink-0 text-[13px] whitespace-nowrap text-(--pn-fg-muted) tabular-nums", className)}
    >
      {text}
    </span>
  )
}

export type SearchFieldProps = {
  value: string
  onChange: (value: string) => void
  /** Defaults to the current section's placeholder from `nav.ts`. */
  placeholder?: string
  /** Accessible name; defaults to the placeholder without its ellipsis. */
  label?: string
  inputRef?: Ref<HTMLInputElement>
  className?: string
}

/**
 * 36px search input (§2.3): `/` focuses it from anywhere, Esc clears it while it has a value, the clear
 * button shows only with a value. The page defers the value and resets its pagination.
 */
export function SearchField({ value, onChange, placeholder, label, inputRef, className }: SearchFieldProps) {
  const { section } = useShellFrame()
  const resolvedPlaceholder = placeholder ?? section?.searchPlaceholder ?? "Search…"
  const accessibleName = label ?? resolvedPlaceholder.replace(/…$/, "")

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Escape" || value === "") return
    event.preventDefault()
    event.stopPropagation()
    onChange("")
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-(--pn-fg-muted)"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={resolvedPlaceholder}
        aria-label={accessibleName}
        autoComplete="off"
        spellCheck={false}
        data-page-search=""
        className="h-9 w-full rounded-(--pn-r-3) border border-(--pn-line-strong) bg-(--pn-surface) pr-9 pl-8 text-[14px] text-(--pn-fg) placeholder:text-(--pn-fg-subtle) [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value !== "" ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-(--pn-r-2) text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:bg-(--pn-muted) hover:text-(--pn-fg)"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}

export type ToolbarProps = {
  /** Controls before the search that scope the whole page, e.g. the FAQ category select and its actions. */
  lead?: ReactNode
  search?: SearchFieldProps
  /** Segmented or popover filters, after the search. */
  filters?: ReactNode
  /** A `Count`, 16px after the filters. */
  count?: ReactNode
}

/** The section-page left slot: lead → search → filters → count (§1.2, §2.3). */
export function Toolbar({ lead, search, filters, count }: ToolbarProps) {
  return (
    <div className="flex w-full min-w-0 items-center gap-4">
      {lead || search || filters ? (
        <div className={cn("flex min-w-0 flex-1 items-center gap-2", lead ? "lg:flex-[0_1_auto]" : "lg:flex-none")}>
          {lead}
          {search ? (
            <SearchField {...search} className={cn("flex-1 lg:w-60 lg:flex-none xl:w-70", search.className)} />
          ) : null}
          {filters}
        </div>
      ) : null}
      {count}
    </div>
  )
}
