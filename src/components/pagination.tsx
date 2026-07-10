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
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  if (pageCount <= 1) return null

  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b)

  return (
    <PaginationRoot className="justify-end pt-3">
      <PaginationContent className="gap-1">
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={page === 1}
            className={
              page === 1
                ? "pointer-events-none opacity-40"
                : "rounded-none border-border text-muted-foreground hover:border-primary hover:bg-accent hover:text-primary"
            }
            onClick={(event) => {
              event.preventDefault()
              if (page > 1) onPageChange(page - 1)
            }}
            text=""
          />
        </PaginationItem>
        {pages.map((value, index) => (
          <PaginationItem key={value}>
            {index > 0 && pages[index - 1] !== value - 1 ? (
              <PaginationEllipsis className="text-muted-foreground" />
            ) : null}
            <PaginationLink
              href="#"
              isActive={value === page}
              className="size-8 rounded-none border-border font-mono text-[10px] text-muted-foreground hover:border-primary hover:bg-accent hover:text-primary data-[active=true]:border-primary data-[active=true]:bg-accent data-[active=true]:text-primary"
              onClick={(event) => {
                event.preventDefault()
                onPageChange(value)
              }}
            >
              {value}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={page === pageCount}
            className={
              page === pageCount
                ? "pointer-events-none opacity-40"
                : "rounded-none border-border text-muted-foreground hover:border-primary hover:bg-accent hover:text-primary"
            }
            onClick={(event) => {
              event.preventDefault()
              if (page < pageCount) onPageChange(page + 1)
            }}
            text=""
          />
        </PaginationItem>
      </PaginationContent>
    </PaginationRoot>
  )
}
