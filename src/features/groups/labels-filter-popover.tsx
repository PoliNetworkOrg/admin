import { ChevronDown, Tags, X } from "lucide-react"
import { useDeferredValue, useEffect, useState } from "react"

import {
  buttonMotion,
  floatingMotion,
  FormDialog,
  IconButton,
  LabelChip,
  Reveal,
  LabelTreeSelector,
  PAGE_SIZES,
  raisedSurface,
  SectionEmpty,
  type TablePagination,
  type TableSort,
} from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { GroupLabel } from "@/features/group-labels/types"
import { cn } from "@/lib/utils"

import type { VisibilityFilter } from "./visibility"

export type LabelFilter = { include: string[]; exclude: string[] }

const EMPTY_LABEL_FILTER: LabelFilter = { include: [], exclude: [] }

function labelFilterCount(filter: LabelFilter) {
  return filter.include.length + filter.exclude.length
}

/** Exact-label match: every "must have" label is present and no "must not have" label is. */
export function matchesLabelFilter(labels: string[], filter: LabelFilter) {
  return (
    filter.include.every((label) => labels.includes(label)) && filter.exclude.every((label) => !labels.includes(label))
  )
}

type GroupListStateOptions = {
  defaultSort: TableSort
  /** The route's `?q=`: prefills the search and replaces it when a later navigation changes it. */
  urlQuery: string
  /** The route's `?visibility=`; the URL is the source of truth. */
  visibility: VisibilityFilter
  onVisibilityChange: (visibility: VisibilityFilter) => void
}

/**
 * Toolbar and table state shared by the group lists: search prefilled from `?q=`, visibility from the route,
 * label filter, sort and pagination. Changing any of them returns to page 1.
 */
export function useGroupListState({ defaultSort, urlQuery, visibility, onVisibilityChange }: GroupListStateOptions) {
  const [query, setQueryValue] = useState(urlQuery)
  const [syncedQuery, setSyncedQuery] = useState(urlQuery)
  const [syncedVisibility, setSyncedVisibility] = useState(visibility)
  const [filter, setFilterValue] = useState<LabelFilter>(EMPTY_LABEL_FILTER)
  const [sort, setSortValue] = useState(defaultSort)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  // A later navigation to the same page with another `?q=` (command palette, reports) replaces the search.
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery)
    setQueryValue(urlQuery)
    setPage(1)
  }
  if (visibility !== syncedVisibility) {
    setSyncedVisibility(visibility)
    setPage(1)
  }

  const deferredQuery = useDeferredValue(query).trim().toLocaleLowerCase()
  const filtering = deferredQuery !== "" || labelFilterCount(filter) > 0 || visibility !== "all"
  /** Search or labels narrow the list beyond the visibility segment, whose own count already shows the rest. */
  const narrowed = deferredQuery !== "" || labelFilterCount(filter) > 0

  /** The current page of `rows` (the page clamps when rows disappear) and the footer props. */
  function paginate<T>(rows: T[]) {
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
    const current = Math.min(page, pageCount)
    const pagination = {
      page: current,
      pageSize,
      total: rows.length,
      onPage: setPage,
      onPageSize: (size: number) => {
        setPageSize(size)
        setPage(1)
      },
    } satisfies TablePagination
    return { rows: rows.slice((current - 1) * pageSize, current * pageSize), pagination }
  }

  return {
    query,
    setQuery: (value: string) => {
      setQueryValue(value)
      setPage(1)
    },
    deferredQuery,
    visibility,
    setVisibility: onVisibilityChange,
    filter,
    setFilter: (value: LabelFilter) => {
      setFilterValue(value)
      setPage(1)
    },
    sort,
    setSort: (value: TableSort) => {
      setSortValue(value)
      setPage(1)
    },
    filtering,
    narrowed,
    clear: () => {
      setQueryValue("")
      setFilterValue(EMPTY_LABEL_FILTER)
      onVisibilityChange("all")
      setPage(1)
    },
    paginate,
  }
}

const collator = new Intl.Collator("en-GB", { sensitivity: "base", numeric: true })

export const compareText = (a: string, b: string) => collator.compare(a, b)

/**
 * Sorts by `compare` in the given direction. Rows whose `unset` returns true stay last in both
 * directions (groups without a tag).
 */
export function sortRows<T>(
  rows: T[],
  compare: (a: T, b: T) => number,
  direction: TableSort["direction"],
  unset: (row: T) => boolean = () => false
) {
  const sign = direction === "asc" ? 1 : -1
  return rows.toSorted((a, b) => {
    const unsetA = unset(a)
    const unsetB = unset(b)
    if (unsetA || unsetB) return Number(unsetA) - Number(unsetB)
    return sign * compare(a, b)
  })
}

function toggled(current: string[], labels: GroupLabel[], select: boolean) {
  const paths = labels.map((label) => label.label)
  if (!select) return current.filter((path) => !paths.includes(path))
  return [...current, ...paths.filter((path) => !current.includes(path))]
}

type LabelsFilterPopoverProps = {
  labels: GroupLabel[]
  value: LabelFilter
  onChange: (value: LabelFilter) => void
  groupCount: number
}

/**
 * The `Labels` toolbar filter: an outline button showing "Labels · n" when active and a 320px
 * popover with "Must have" / "Must not have" pickers. A label picked on one side is hidden on the other.
 */
export function LabelsFilterPopover({ labels, value, onChange, groupCount }: LabelsFilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<"include" | "exclude" | null>(null)
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(width < 760px)")
    const update = () => setMobile(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  const count = labelFilterCount(value)
  const active = count > 0

  const content = (
    <>
      {labels.length === 0 ? (
        <SectionEmpty title="No labels have been created yet" className="px-1 py-4" />
      ) : (
        <>
          {(["include", "exclude"] as const).map((side) => (
            <section key={side} className="flex flex-col gap-1.5">
              <h2 className="text-[13px] leading-5 font-medium text-(--pn-fg)">
                {side === "include" ? "Must have" : "Must not have"}
              </h2>
              <div className="flex min-h-10 flex-wrap items-center gap-1 rounded-(--pn-r-3) border border-(--pn-line-strong) bg-(--pn-surface) px-2 py-1">
                {value[side].map((path) => {
                  const label = labels.find((candidate) => candidate.label === path)
                  return label ? (
                    <span key={path} className="inline-flex min-w-0 items-center">
                      <LabelChip label={label} />
                      <IconButton
                        icon={X}
                        label={`Remove ${path} filter`}
                        onClick={() => onChange({ ...value, [side]: value[side].filter((item) => item !== path) })}
                      />
                    </span>
                  ) : null
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(buttonMotion, "text-(--pn-fg-muted)")}
                  aria-expanded={expanded === side}
                  onClick={() => setExpanded(expanded === side ? null : side)}
                >
                  {expanded === side ? "Close picker" : "Add…"}
                </Button>
              </div>
              <Reveal open={expanded === side}>
                <LabelTreeSelector
                  allLabels={labels.filter(
                    (label) => !value[side === "include" ? "exclude" : "include"].includes(label.label)
                  )}
                  selected={value[side]}
                  onToggleMany={(picked, select) =>
                    onChange({ ...value, [side]: toggled(value[side], picked, select) })
                  }
                  className="h-52 max-shell:h-44"
                />
              </Reveal>
            </section>
          ))}
          <div className="flex items-center justify-between border-t border-(--pn-line) pt-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!active}
              onClick={() => onChange(EMPTY_LABEL_FILTER)}
              className={cn(buttonMotion, "self-start")}
            >
              Clear label filters
            </Button>
            <span className="text-xs text-(--pn-fg-muted) tabular-nums">{groupCount} groups</span>
          </div>
        </>
      )}
    </>
  )

  if (mobile)
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            buttonMotion,
            "h-10 shrink-0 gap-2 rounded-[9px] border-(--pn-line-strong) bg-(--pn-surface) px-3.5 text-[14px] data-popup-open:bg-(--pn-muted)",
            active &&
              "border-[color-mix(in_oklch,var(--pn-accent)_40%,transparent)] hover:border-[color-mix(in_oklch,var(--pn-accent)_60%,transparent)]"
          )}
          onClick={() => setOpen(true)}
        >
          <Tags aria-hidden strokeWidth={1.75} data-icon="inline-start" />
          Labels
          {active && (
            <span className="tabular-nums text-(--pn-fg-muted)">
              <span aria-hidden>· </span>
              {count}
              <span className="sr-only"> active</span>
            </span>
          )}
          <ChevronDown aria-hidden data-icon="inline-end" className="text-(--pn-fg-muted)" />
        </Button>
        <FormDialog
          open={open}
          onOpenChange={setOpen}
          title="Filter by label"
          noun="label filter"
          dirty={false}
          onSubmit={() => {}}
        >
          {content}
        </FormDialog>
      </>
    )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              buttonMotion,
              "h-10 shrink-0 gap-2 rounded-[9px] border-(--pn-line-strong) bg-(--pn-surface) px-3.5 text-[14px] data-popup-open:bg-(--pn-muted)",
              active &&
                "border-[color-mix(in_oklch,var(--pn-accent)_40%,transparent)] hover:border-[color-mix(in_oklch,var(--pn-accent)_60%,transparent)]"
            )}
          />
        }
      >
        <Tags aria-hidden strokeWidth={1.75} data-icon="inline-start" />
        Labels
        {active && (
          <span className="tabular-nums text-(--pn-fg-muted)">
            <span aria-hidden>· </span>
            {count}
            <span className="sr-only"> active</span>
          </span>
        )}
        <ChevronDown aria-hidden data-icon="inline-end" className="text-(--pn-fg-muted)" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        aria-label="Filter by label"
        className={cn(
          raisedSurface,
          floatingMotion,
          "max-h-(--available-height) w-80 gap-3 overflow-y-auto rounded-(--pn-r-4) p-3 max-lg:max-w-[calc(100vw-2rem)]"
        )}
      >
        {content}
      </PopoverContent>
    </Popover>
  )
}
