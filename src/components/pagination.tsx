import { ChevronsLeft, ChevronsRight } from "lucide-react"
import { Fragment } from "react"
import {
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Pagination as PaginationRoot,
} from "@/components/ui/pagination"

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
  if (pageCount <= 1 && !onPageSizeChange) return null

  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b)

  return (
    <div className="flex items-center justify-between gap-3 pt-3">
      <label className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
        Rows per page
        <select
          aria-label="Rows per page"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-8 rounded-lg border border-border bg-card px-2 font-mono text-[10px] text-foreground outline-none focus:border-primary"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      {pageCount > 1 && (
        <PaginationRoot className="justify-end">
          <PaginationContent className="gap-1">
            <PaginationItem>
              <PaginationLink
                href="#"
                aria-label="Go to first page"
                aria-disabled={page === 1}
                className={
                  page === 1
                    ? "pointer-events-none size-8 border-border text-muted-foreground opacity-40"
                    : "size-8 border-border text-muted-foreground hover:border-primary hover:bg-accent hover:text-primary"
                }
                onClick={(event) => {
                  event.preventDefault()
                  if (page > 1) onPageChange(1)
                }}
              >
                <ChevronsLeft className="size-4" />
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={page === 1}
                className={
                  page === 1
                    ? "pointer-events-none opacity-40"
                    : "border-border text-muted-foreground hover:border-primary hover:bg-accent hover:text-primary"
                }
                onClick={(event) => {
                  event.preventDefault()
                  if (page > 1) onPageChange(page - 1)
                }}
                text=""
              />
            </PaginationItem>
            {pages.map((value, index) => (
              <Fragment key={value}>
                {index > 0 && pages[index - 1] !== value - 1 && (
                  <PaginationItem>
                    <PaginationEllipsis className="text-muted-foreground" />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink
                    href="#"
                    isActive={value === page}
                    className="size-8 border-border font-mono text-[10px] text-muted-foreground hover:border-primary hover:bg-accent hover:text-primary data-[active=true]:border-primary data-[active=true]:bg-accent data-[active=true]:text-primary"
                    onClick={(event) => {
                      event.preventDefault()
                      onPageChange(value)
                    }}
                  >
                    {value}
                  </PaginationLink>
                </PaginationItem>
              </Fragment>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={page === pageCount}
                className={
                  page === pageCount
                    ? "pointer-events-none opacity-40"
                    : "border-border text-muted-foreground hover:border-primary hover:bg-accent hover:text-primary"
                }
                onClick={(event) => {
                  event.preventDefault()
                  if (page < pageCount) onPageChange(page + 1)
                }}
                text=""
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink
                href="#"
                aria-label="Go to last page"
                aria-disabled={page === pageCount}
                className={
                  page === pageCount
                    ? "pointer-events-none size-8 border-border text-muted-foreground opacity-40"
                    : "size-8 border-border text-muted-foreground hover:border-primary hover:bg-accent hover:text-primary"
                }
                onClick={(event) => {
                  event.preventDefault()
                  if (page < pageCount) onPageChange(pageCount)
                }}
              >
                <ChevronsRight className="size-4" />
              </PaginationLink>
            </PaginationItem>
          </PaginationContent>
        </PaginationRoot>
      )}
    </div>
  )
}
