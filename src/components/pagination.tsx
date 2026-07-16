import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MoreHorizontal } from "lucide-react"
import { Fragment } from "react"
import { Button } from "@/components/ui/button"

export function Pagination({
  page,
  pageCount,
  onPageChange,
  pageSize,
  pageSizeOptions = [10, 20, 25, 50, 100],
  onPageSizeChange,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  pageSize: number
  pageSizeOptions?: number[]
  onPageSizeChange: (pageSize: number) => void
}) {
  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Rows per page
        <select
          aria-label="Rows per page"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-9 rounded-lg border border-input bg-card px-2 text-xs text-foreground outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      {pageCount > 1 && (
        <nav aria-label="Pagination">
          <ul className="flex items-center gap-1">
            <li className="max-[520px]:hidden">
              <PageButton label="Go to first page" disabled={page === 1} onClick={() => onPageChange(1)}>
                <ChevronsLeft />
              </PageButton>
            </li>
            <li>
              <PageButton label="Go to previous page" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
                <ChevronLeft />
              </PageButton>
            </li>
            {pages.map((value, index) => (
              <Fragment key={value}>
                {index > 0 && pages[index - 1] !== value - 1 && (
                  <li
                    className="flex size-9 items-center justify-center text-muted-foreground max-[520px]:hidden"
                    aria-hidden
                  >
                    <MoreHorizontal className="size-4" />
                  </li>
                )}
                <li className={value === page ? "" : "max-[520px]:hidden"}>
                  <Button
                    variant={value === page ? "outline" : "ghost"}
                    size="icon-sm"
                    aria-label={`Go to page ${value}`}
                    aria-current={value === page ? "page" : undefined}
                    className={value === page ? "border-primary bg-accent text-primary" : "text-muted-foreground"}
                    onClick={() => onPageChange(value)}
                  >
                    {value}
                  </Button>
                </li>
              </Fragment>
            ))}
            <li>
              <PageButton label="Go to next page" disabled={page === pageCount} onClick={() => onPageChange(page + 1)}>
                <ChevronRight />
              </PageButton>
            </li>
            <li className="max-[520px]:hidden">
              <PageButton label="Go to last page" disabled={page === pageCount} onClick={() => onPageChange(pageCount)}>
                <ChevronsRight />
              </PageButton>
            </li>
          </ul>
        </nav>
      )}
    </div>
  )
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      disabled={disabled}
      className="text-muted-foreground hover:text-primary"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
