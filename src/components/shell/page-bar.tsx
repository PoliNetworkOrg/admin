import {
  type AnyRouter,
  Link,
  type RegisteredRouter,
  type ValidateLinkOptions,
  useRouterState,
} from "@tanstack/react-router"
import { ArrowLeft, Search, X } from "lucide-react"
import { createContext, type KeyboardEvent, type ReactNode, type Ref, useContext } from "react"

import { buttonVariants } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { DashboardPath, Section, Service } from "./nav"
import { ServiceGlyph } from "./service-glyph"

/** Template names share one desktop width so headers and page bodies keep the same edges. */
export type ContentWidth = "wide" | "tree" | "record" | "settings" | "overview"

const widthClass = {
  wide: "max-w-[1280px]",
  tree: "max-w-[1280px]",
  record: "max-w-[1280px]",
  settings: "max-w-[1280px]",
  overview: "max-w-[1280px]",
} satisfies Record<ContentWidth, string>

export type ShellFrame = {
  /** The page's scroll container. */
  main: HTMLElement | null
  setMain: (main: HTMLElement | null) => void
  service: Service
  section: Section | null
  /** Where a service's rail item leads: its last visited section this session, else its first. */
  serviceHref: (service: Service) => DashboardPath
  openPalette: () => void
}

export const ShellFrameContext = createContext<ShellFrame | null>(null)

/** Whether the caller renders inside `DashboardShell` (e.g. an error boundary below `/dashboard`). */
export function useInShell() {
  return useContext(ShellFrameContext) !== null
}

export function useShellFrame() {
  const frame = useContext(ShellFrameContext)
  if (!frame) throw new Error("PageBar and PageContent must be rendered inside DashboardShell.")
  return frame
}

/**
 * The pathname of the page `<Outlet>` is rendering. `location` switches as soon as a navigation starts, while the
 * previous page stays on screen until the next route's loader resolves (or its pending skeleton shows); reading the
 * deepest rendered match keeps the panel and page keys in step with what is actually visible.
 */
export function useRenderedPathname() {
  return useRouterState({ select: (state) => state.matches.at(-1)?.pathname ?? state.location.pathname })
}

const gutter = "px-4 shell:px-6 min-[1200px]:px-9"

/** Centers the page content at the template width with the shell's side padding, below the page header. */
export function PageContent({ width = "wide", children }: { width?: ContentWidth; children: ReactNode }) {
  return (
    <div className={cn("flex-1 pb-7 shell:pb-12", gutter)}>
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
  /** Match the page's `PageContent` width. */
  width?: ContentWidth
  /** The toolbar row under the header: a `Toolbar` (search, filters, segmented controls). */
  left?: ReactNode
  /** The page's primary action (last), plus at most one `outline` secondary; record actions on deep pages. */
  right?: ReactNode
  /** The `h1`. Section pages default to the section title; Overview and Account pass theirs. */
  title?: string
  /** One line of context under the `h1`: a count or the page's purpose. */
  description?: ReactNode
  /** Deep pages: the back button. The record's own `h1` is in the content (`RecordHeader`). */
  back?: PageBarBack<TRouter, TOptions>
  /** Deep pages: the parent context after the section in the breadcrumb ("Users / 5021007919"). */
  context?: ReactNode
  /** Render `context` in DM Mono, for identifiers like Telegram IDs. */
  contextMono?: boolean
}

/** The section panel only appears for services with more than one section; a single one would just repeat the rail. */
export function servicePanelVisible(service: Service) {
  return service.sections.length > 1
}

/** Header actions are 40px like the toolbar controls; below 760px they share the full width under the title. */
const headerActions =
  "flex flex-wrap items-center justify-end gap-2 max-shell:w-full max-shell:[&>*]:flex-1 [&>:is([data-slot=button],[data-slot=dropdown-menu-trigger])]:h-10 [&>:is([data-slot=button],[data-slot=dropdown-menu-trigger])]:px-3.5 [&>:is([data-slot=button],[data-slot=dropdown-menu-trigger])]:text-[14px]"

/** Record actions on deep pages keep their own width on phones, left-aligned under the breadcrumb. */
const deepHeaderActions = "max-shell:justify-start max-shell:[&>*]:flex-none"

const titleText = "text-[22px]/7 font-semibold tracking-[-0.01em] text-(--pn-fg) shell:text-[24px]/8"

/**
 * The page header, at the top of the scrolling page: the `h1` with one line of context and the actions on the right,
 * then the toolbar row. Deep pages show a back button and the breadcrumb instead of the `h1`. Below 760px the actions
 * take the full width under the title.
 */
export function PageBar<TRouter extends AnyRouter = RegisteredRouter, TOptions = unknown>(
  props: PageBarProps<TRouter, TOptions>
): ReactNode
export function PageBar({
  width = "wide",
  left,
  right,
  title,
  description,
  back,
  context,
  contextMono = false,
}: PageBarProps) {
  const { service, section } = useShellFrame()
  const heading = title ?? section?.title
  // A service with a single section has no panel to name it: its icon heads the page instead (WhatsApp).
  const serviceTile = section !== null && !servicePanelVisible(service)

  let head: ReactNode
  if (back) {
    head = (
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <BackButton {...back} />
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-1.5 text-[13px] text-(--pn-fg-muted)">
              {section ? (
                <li className="shrink-0">
                  <Link to={section.path} className="transition-[color] duration-120 hover:text-(--pn-fg)">
                    {section.title}
                  </Link>
                </li>
              ) : null}
              {context && context !== section?.title ? (
                <>
                  <li aria-hidden className="text-(--pn-fg-subtle)">
                    /
                  </li>
                  <li className={cn("truncate", contextMono && "font-mono")}>{context}</li>
                </>
              ) : null}
            </ol>
          </nav>
        </div>
        {right ? <div className={cn(headerActions, deepHeaderActions)}>{right}</div> : null}
      </div>
    )
  } else {
    head = (
      <div
        className={cn(
          "flex flex-wrap items-end justify-between gap-x-4 gap-y-3",
          // A bare h1 (Overview, Account) sits at the top; with context or actions the row keeps 56px.
          (description || right) && "shell:min-h-14"
        )}
      >
        <div className="flex min-w-0 items-center gap-3.5">
          {serviceTile ? (
            <span className="grid size-11 shrink-0 place-items-center rounded-[11px] border border-(--pn-line) bg-(--pn-muted) text-(--pn-fg) max-shell:hidden">
              <ServiceGlyph service={service} className="size-5.5" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className={titleText}>{heading}</h1>
            {description ? <p className="mt-0.5 text-[14px] text-(--pn-fg-muted) tabular-nums">{description}</p> : null}
          </div>
        </div>
        {right ? <div className={headerActions}>{right}</div> : null}
      </div>
    )
  }

  return (
    <header data-page-bar="" className={cn("pt-4.5 pb-4 shell:pt-7 shell:pb-5", gutter)}>
      <div className={cn("mx-auto flex w-full flex-col gap-4 shell:gap-5", widthClass[width])}>
        {head}
        {left ? <div className="flex min-w-0">{left}</div> : null}
      </div>
    </header>
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
              buttonVariants({ variant: "outline", size: "icon-sm" }),
              "border-(--pn-line-strong) bg-(--pn-surface) text-(--pn-fg) hover:bg-(--pn-hover) active:translate-y-0"
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
 * ", {n} {noun}" segments. Pass the singular noun: `<Count value={42} noun="group" />`.
 */
export function Count({ parts = [], className, ...first }: CountProps) {
  const text = [first, ...parts].map(formatCountPart).join(", ")
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
 * 40px search field: `/` focuses it from anywhere (the hint shows on fine pointers), Esc clears it while it has a
 * value, the clear button replaces the hint once there is a value. The page defers the value and resets its pagination.
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
    <div className={cn("group/search relative min-w-0", className)}>
      <Search
        aria-hidden
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-(--pn-fg-muted)"
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
        className="h-10 w-full rounded-[9px] border border-(--pn-line-strong) bg-(--pn-surface) pr-10 pl-10 text-[14px] text-(--pn-fg) transition-[border-color] duration-120 text-ellipsis placeholder:text-(--pn-fg-subtle) hover:border-(--pn-hover-line) max-shell:text-base [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value !== "" ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-(--pn-r-2) text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:bg-(--pn-hover) hover:text-(--pn-fg)"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        <kbd
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-[5px] border border-(--pn-line-strong) bg-(--pn-surface-raised) px-1.5 font-mono text-[11px] leading-4 text-(--pn-fg-muted) group-focus-within/search:hidden pointer-coarse:hidden max-shell:hidden"
        >
          /
        </kbd>
      )}
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

/**
 * The toolbar row under the page header: lead → search → filters → count. Controls are 40px; the row wraps, and below
 * 760px the search takes a row of its own.
 */
export function Toolbar({ lead, search, filters, count }: ToolbarProps) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-wrap items-center gap-2.5 max-shell:gap-2",
        // Below 760px a segmented control takes the rest of its row (basis 0, so it never wraps alone), its segments
        // share that width, and it scrolls sideways rather than overflow.
        "max-shell:[&_[role=group]]:max-w-full max-shell:[&_[role=group]]:min-w-0 max-shell:[&_[role=group]]:flex-1 max-shell:[&_[role=group]]:basis-0 max-shell:[&_[role=group]]:overflow-x-auto max-shell:[&_[role=group]]:[scrollbar-width:none] max-shell:[&_[role=group]>*]:flex-[1_0_auto] max-shell:[&_[role=group]>*]:gap-1 max-shell:[&_[role=group]>*]:px-2"
      )}
    >
      {lead}
      {search ? (
        <SearchField
          {...search}
          className={cn("max-w-115 flex-[1_1_300px] max-shell:max-w-none max-shell:basis-full", search.className)}
        />
      ) : null}
      {filters}
      {count ? (
        <div className="ml-auto flex shrink-0 pl-1 max-shell:ml-0 max-shell:basis-full max-shell:pl-0">{count}</div>
      ) : null}
    </div>
  )
}
