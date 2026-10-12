import { ChevronLeft, ChevronRight } from "lucide-react"
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

const pageButton = cn(
  buttonMotion,
  "h-8 w-auto min-w-8 max-shell:h-9 max-shell:min-w-9 px-2 text-[13px] font-normal text-(--pn-fg-muted) tabular-nums active:not-aria-[haspopup]:translate-y-0 hover:bg-(--pn-accent-soft) hover:text-(--pn-fg) aria-[current=page]:bg-(--pn-surface-raised) aria-[current=page]:text-(--pn-fg) aria-[current=page]:shadow-[inset_0_0_0_1px_var(--pn-line-strong)]"
)

/**
 * Table footer: "Showing 1–20 of 1,318", rows per page and ‹ 1 2 3 … 66 ›. Below 640px of table width the range
 * text goes and the pages collapse to "‹ 3 of 66 ›".
 */
export function TablePaginationBar({ page, pageSize, total, onPage, onPageSize }: TablePagination) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  const atStart = page <= 1
  const atEnd = page >= pageCount
  const labelId = useId()

  return (
    <div className="flex min-h-13 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-(--pn-line) py-2.5 pr-3 pl-4 text-[13px] text-(--pn-fg-muted) @max-[640px]:justify-center @max-[640px]:px-2.5">
      <p className="whitespace-nowrap tabular-nums @max-[640px]:hidden">
        Showing{" "}
        <span className="text-(--pn-fg)">
          {formatNumber(first)}–{formatNumber(last)}
        </span>{" "}
        of {formatNumber(total)}
      </p>

      <div className="flex flex-wrap items-center gap-4">
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
              className="w-[68px] border-(--pn-line-strong) bg-(--pn-muted) text-[13px] text-(--pn-fg) tabular-nums data-[size=default]:h-8 max-shell:data-[size=default]:h-9 dark:bg-(--pn-muted) dark:hover:bg-(--pn-accent-soft)"
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

        <nav aria-label="Pagination" className="flex items-center gap-0.5">
          <IconButton
            label="Previous page"
            icon={ChevronLeft}
            disabled={atStart}
            onClick={() => onPage(page - 1)}
            className="size-8 max-shell:size-9"
          />
          {pageItems(page, pageCount).map((item) =>
            item.kind === "gap" ? (
              <span key={item.id} aria-hidden className="w-6 text-center @max-[640px]:hidden">
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
                className={cn(pageButton, item.page !== page && "@max-[640px]:hidden")}
              >
                {formatNumber(item.page)}
              </Button>
            )
          )}
          <span className="hidden px-2 whitespace-nowrap tabular-nums @max-[640px]:inline">
            of {formatNumber(pageCount)}
          </span>
          <IconButton
            label="Next page"
            icon={ChevronRight}
            disabled={atEnd}
            onClick={() => onPage(page + 1)}
            className="size-8 max-shell:size-9"
          />
        </nav>
      </div>
    </div>
  )
}
