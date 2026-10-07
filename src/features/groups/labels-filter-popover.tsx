import { ChevronDown } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  floatingMotion,
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
}

/**
 * The `Labels` toolbar filter (§2.3, §7.6): an outline button showing "Labels · n" when active and a 320px
 * popover with "Must have" / "Must not have" pickers. A label picked on one side is hidden on the other.
 */
export function LabelsFilterPopover({ labels, value, onChange }: LabelsFilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const count = labelFilterCount(value)
  const active = count > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              buttonMotion,
              "shrink-0 gap-1.5 data-popup-open:bg-(--pn-muted)",
              active &&
                "border-[color-mix(in_oklch,var(--pn-accent)_40%,transparent)] hover:border-[color-mix(in_oklch,var(--pn-accent)_60%,transparent)]"
            )}
          />
        }
      >
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
        {labels.length === 0 ? (
          <SectionEmpty title="No labels have been created yet" className="px-1 py-4" />
        ) : (
          <>
            <section className="flex flex-col gap-1.5">
              <h2 className="text-[13px] leading-5 font-medium text-(--pn-fg)">Must have</h2>
              <LabelTreeSelector
                allLabels={labels.filter((label) => !value.exclude.includes(label.label))}
                selected={value.include}
                onToggleMany={(picked, select) =>
                  onChange({ ...value, include: toggled(value.include, picked, select) })
                }
                className="h-64"
              />
            </section>
            <section className="flex flex-col gap-1.5">
              <h2 className="text-[13px] leading-5 font-medium text-(--pn-fg)">Must not have</h2>
              <LabelTreeSelector
                allLabels={labels.filter((label) => !value.include.includes(label.label))}
                selected={value.exclude}
                onToggleMany={(picked, select) =>
                  onChange({ ...value, exclude: toggled(value.exclude, picked, select) })
                }
                className="h-64"
              />
            </section>
            <Button
              variant="ghost"
              size="sm"
              disabled={!active}
              onClick={() => onChange(EMPTY_LABEL_FILTER)}
              className={cn(buttonMotion, "self-start")}
            >
              Clear label filters
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
