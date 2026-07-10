import { ChevronLeft, ChevronRight } from "lucide-react"

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
    <nav className="pagination" aria-label="Table pagination">
      <button disabled={page === 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
        <ChevronLeft size={15} />
      </button>
      {pages.map((value, index) => (
        <span key={value} className="pagination-slot">
          {index > 0 && pages[index - 1] !== value - 1 && <i>…</i>}
          <button
            className={value === page ? "active" : ""}
            aria-current={value === page ? "page" : undefined}
            onClick={() => onPageChange(value)}
          >
            {value}
          </button>
        </span>
      ))}
      <button disabled={page === pageCount} onClick={() => onPageChange(page + 1)} aria-label="Next page">
        <ChevronRight size={15} />
      </button>
    </nav>
  )
}
