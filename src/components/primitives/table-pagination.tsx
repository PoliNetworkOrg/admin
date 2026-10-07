import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { useId } from "react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import { IconButton } from "./icon-button"
import { buttonMotion, floatingMotion, raisedSurface } from "./motion"

export const PAGE_SIZES = [20, 50, 100]

export type TablePagination = {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  onPageSize: (pageSize: number) => void
}

type PageItem = { kind: "page"; page: number } | { kind: "gap"; id: string }

function pageItems(page: number, pageCount: number): PageItem[] {
  const pages = (from: number, to: number): PageItem[] =>
    Array.from({ length: to - from + 1 }, (_, index) => ({ kind: "page", page: from + index }))

  if (pageCount <= 7) return pages(1, pageCount)

  const start = page <= 3 ? 2 : Math.min(page - 1, pageCount - 3)
  const end = page >= pageCount - 2 ? pageCount - 1 : Math.max(page + 1, 4)

  return [
    { kind: "page", page: 1 },
    ...(start > 2 ? [{ kind: "gap" as const, id: "start" }] : []),
    ...pages(start, end),
    ...(end < pageCount - 1 ? [{ kind: "gap" as const, id: "end" }] : []),
    { kind: "page", page: pageCount },
  ]
}

/** Table footer: "Showing 1–20 of 1,318", rows per page, page buttons; "‹ 3 / 66 ›" below 640px of table width. */
export function TablePaginationBar({ page, pageSize, total, onPage, onPageSize }: TablePagination) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  const atStart = page <= 1
  const atEnd = page >= pageCount
  const labelId = useId()

  return (
    <div className="flex min-h-13 items-center justify-between gap-4 border-t border-(--pn-line) px-5 py-2 text-[13px] text-(--pn-fg-muted)">
      <p className="whitespace-nowrap tabular-nums @max-[640px]:hidden">
        Showing {formatNumber(first)}–{formatNumber(last)} of {formatNumber(total)}
      </p>

      <div className="flex items-center gap-6 @max-[640px]:hidden">
        <div className="flex items-center gap-2">
          <span id={labelId} className="whitespace-nowrap">
            Rows per page
          </span>
          <Select
            value={pageSize}
            onValueChange={(value) => {
              if (value !== null) onPageSize(value)
            }}
          >
            <SelectTrigger
              aria-labelledby={labelId}
              className="w-[72px] border-(--pn-line-strong) bg-(--pn-surface) text-[13px] text-(--pn-fg) tabular-nums data-[size=default]:h-9 dark:bg-(--pn-surface) dark:hover:bg-(--pn-muted)"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={cn(raisedSurface, floatingMotion)}>
              {PAGE_SIZES.map((size) => (
                <SelectItem
                  key={size}
                  value={size}
                  className="h-9 text-[13px] tabular-nums focus:bg-(--pn-muted) focus:text-(--pn-fg) not-data-[variant=destructive]:focus:**:text-(--pn-fg)"
                >
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <nav aria-label="Pagination" className="flex items-center gap-1">
          <IconButton label="First page" icon={ChevronsLeft} disabled={atStart} onClick={() => onPage(1)} />
          <IconButton label="Previous page" icon={ChevronLeft} disabled={atStart} onClick={() => onPage(page - 1)} />
          {pageItems(page, pageCount).map((item) =>
            item.kind === "gap" ? (
              <span key={item.id} aria-hidden className="w-6 text-center">
                …
              </span>
            ) : (
              <Button
                key={item.page}
                variant="ghost"
                size="icon-sm"
                aria-label={`Page ${item.page}`}
                aria-current={item.page === page ? "page" : undefined}
                onClick={() => onPage(item.page)}
                className={cn(
                  buttonMotion,
                  "w-auto min-w-9 px-2 text-[13px] font-normal text-(--pn-fg-muted) tabular-nums active:not-aria-[haspopup]:translate-y-0 hover:bg-(--pn-muted) hover:text-(--pn-fg) aria-[current=page]:bg-(--pn-accent-soft) aria-[current=page]:text-(--pn-accent)"
                )}
              >
                {formatNumber(item.page)}
              </Button>
            )
          )}
          <IconButton label="Next page" icon={ChevronRight} disabled={atEnd} onClick={() => onPage(page + 1)} />
          <IconButton label="Last page" icon={ChevronsRight} disabled={atEnd} onClick={() => onPage(pageCount)} />
        </nav>
      </div>

      <nav aria-label="Pagination" className="flex w-full items-center justify-between @min-[640px]:hidden">
        <IconButton label="Previous page" icon={ChevronLeft} disabled={atStart} onClick={() => onPage(page - 1)} />
        <span className="tabular-nums">
          {formatNumber(page)} / {formatNumber(pageCount)}
        </span>
        <IconButton label="Next page" icon={ChevronRight} disabled={atEnd} onClick={() => onPage(page + 1)} />
      </nav>
    </div>
  )
}
