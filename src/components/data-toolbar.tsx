import { Plus, Search } from "lucide-react"
import type { ReactNode } from "react"

export function DataToolbar({
  title,
  description,
  count,
  onSearch,
  action,
  onAction,
  children,
}: {
  title: string
  description: string
  count: number
  onSearch?: (value: string) => void
  action?: string
  onAction?: () => void
  children?: ReactNode
}) {
  return (
    <>
      <section className="data-intro">
        <div>
          <p className="eyebrow">DIRECTORY</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {action && onAction && (
          <button className="primary-button" onClick={onAction}>
            <Plus size={16} />
            {action}
          </button>
        )}
      </section>
      <section className="table-tools">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label={`Search ${title}`}
            onChange={(event) => onSearch?.(event.target.value)}
            placeholder="Filter records…"
          />
        </label>
        <span className="record-count">
          <b>{count}</b> records
        </span>
        {children}
      </section>
    </>
  )
}
