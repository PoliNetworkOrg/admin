import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react"
import type { KeyboardEvent, MouseEvent, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

import { hideBelowClass } from "./container-hide"
import { InlineAlert } from "./inline-alert"
import { buttonMotion } from "./motion"
import { SkeletonRows } from "./skeletons"
import { type TablePagination, TablePaginationBar } from "./table-pagination"

export type DataTableColumn<T> = {
  id: string
  label: string
  cell: (row: T) => ReactNode
  sortable?: boolean
  /** `end` for numeric quantities. */
  align?: "start" | "end"
  /** Identifiers (Telegram IDs, chat ids, label paths). */
  mono?: boolean
  /** 1 = most important. Columns without a priority, the first column and actions never hide. */
  priority?: number
  /** Width in px this column needs; drives when lower-priority columns hide. Defaults to 140. */
  minWidth?: number
  /**
   * Takes the width the other columns leave, so a `truncate` title uses the free space instead of a fixed
   * `max-w-*` cap. Use on one column: the title, or the free-text column when the title is short (Grants › Reason).
   */
  fill?: boolean
  className?: string
}

export type TableSort = { column: string; direction: "asc" | "desc" }

export type DataTableError = { message: ReactNode; onRetry: () => void; retrying?: boolean }

export type DataTableRowProps = { className?: string; "data-state"?: string }

type DataTableProps<T> = {
  /** Accessible name of the table. */
  label: string
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string | number
  sort?: TableSort
  onSort?: (sort: TableSort) => void
  onRowClick?: (row: T) => void
  /** Name used in the row's "Open {name}" label. */
  rowLabel?: (row: T) => string
  /**
   * Makes the first cell a real link too, so middle-click and ⌘-click open it. `null`/`undefined` marks a row with
   * nowhere to go: it is neither a link nor clickable (no focus stop, no pointer, `onRowClick` is not called).
   */
  rowHref?: (row: T) => string | null | undefined
  /** Icon buttons for the row; a `tone="danger"` button last gets the extra gap. */
  actions?: (row: T) => ReactNode
  /** Width in px the actions column needs (36px per icon plus gaps and padding). Defaults to 176. */
  actionsWidth?: number
  /** Extra row attributes, e.g. a fade-out class on a row being removed. */
  rowProps?: (row: T) => DataTableRowProps
  pagination?: TablePagination
  loading?: boolean
  loadingLabel?: string
  empty: ReactNode
  error?: DataTableError
  selectedRowId?: string | number
  className?: string
}

const DEFAULT_MIN_WIDTH = 140
// `max-width: 0` drops the column's min-content width, so the auto table layout gives it the leftover space.
const fillClass = "w-full max-w-0"
const DEFAULT_ACTIONS_WIDTH = 176

function columnHideClasses<T>(columns: DataTableColumn<T>[], actionsWidth: number): Map<string, string> {
  const fixed = columns.filter((column, index) => index === 0 || column.priority === undefined)
  const ranked = columns
    .filter((column, index) => index > 0 && column.priority !== undefined)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

  let width = fixed.reduce((sum, column) => sum + (column.minWidth ?? DEFAULT_MIN_WIDTH), 0)
  width += actionsWidth

  const classes = new Map<string, string>()
  for (const column of ranked) {
    width += column.minWidth ?? DEFAULT_MIN_WIDTH
    const hide = hideBelowClass(width)
    if (hide) classes.set(column.id, hide)
  }
  return classes
}

function edgePadding(index: number, count: number) {
  return cn("px-4", index === 0 && "pl-5", index === count - 1 && "pr-5")
}

function SortIcon({ direction }: { direction: "asc" | "desc" | null }) {
  if (direction === "asc") return <ChevronUp aria-hidden className="size-3 text-(--pn-fg)" />
  if (direction === "desc") return <ChevronDown aria-hidden className="size-3 text-(--pn-fg)" />
  return (
    <ChevronsUpDown
      aria-hidden
      className="size-3 text-(--pn-fg-subtle) opacity-0 transition-opacity duration-120 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100"
    />
  )
}

/** Right-aligned icon actions; a `data-tone="danger"` child gets 8px extra separation. */
export function RowActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-end gap-1 [&>[data-tone=danger]]:ml-2", className)}>{children}</div>
  )
}

function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

/** Surface, sortable 36px header, 44px rows, actions column, footer pagination, loading/empty/error slots. */
export function DataTable<T>({
  label,
  columns,
  rows,
  getRowId,
  sort,
  onSort,
  onRowClick,
  rowLabel,
  rowHref,
  actions,
  actionsWidth = DEFAULT_ACTIONS_WIDTH,
  rowProps,
  pagination,
  loading = false,
  loadingLabel = "Loading…",
  empty,
  error,
  selectedRowId,
  className,
}: DataTableProps<T>) {
  const hasActions = actions !== undefined
  const cellCount = columns.length + (hasActions ? 1 : 0)
  const hideClasses = columnHideClasses(columns, hasActions ? actionsWidth : 0)
  const showRows = !loading && !error && rows.length > 0
  const showPagination = showRows && pagination !== undefined && pagination.total > pagination.pageSize

  function toggleSort(column: string) {
    if (!onSort) return
    const direction = sort?.column === column && sort.direction === "asc" ? "desc" : "asc"
    onSort({ column, direction })
  }

  function openRow(event: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (event.target !== event.currentTarget) return
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    onRowClick?.(row)
  }

  function renderFirstCell(href: string | null | undefined, content: ReactNode) {
    if (href == null) return content
    return (
      <a
        href={href}
        tabIndex={-1}
        onClick={(event) => {
          if (isPlainClick(event)) event.preventDefault()
        }}
        className="text-inherit"
      >
        {content}
      </a>
    )
  }

  function renderBody() {
    if (loading) return <SkeletonRows columns={cellCount} />
    if (error) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={cellCount} className="p-4 whitespace-normal">
            <InlineAlert
              tone="danger"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={error.retrying}
                  aria-busy={error.retrying || undefined}
                  onClick={error.onRetry}
                  className={buttonMotion}
                >
                  Retry
                </Button>
              }
            >
              {error.message}
            </InlineAlert>
          </TableCell>
        </TableRow>
      )
    }
    if (!rows.length) {
      return (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={cellCount} className="p-0 whitespace-normal">
            {empty}
          </TableCell>
        </TableRow>
      )
    }
    return rows.map((row) => {
      const id = getRowId(row)
      const extra = rowProps?.(row)
      const href = rowHref?.(row)
      const interactive = onRowClick !== undefined && (rowHref === undefined || href != null)
      return (
        <TableRow
          key={id}
          data-state={extra?.["data-state"]}
          tabIndex={interactive ? 0 : undefined}
          aria-label={interactive && rowLabel ? `Open ${rowLabel(row)}` : undefined}
          data-selected={selectedRowId === id || undefined}
          onClick={
            interactive
              ? (event) => {
                  if (isPlainClick(event)) onRowClick(row)
                }
              : undefined
          }
          onKeyDown={interactive ? (event) => openRow(event, row) : undefined}
          className={cn(
            "h-11 border-(--pn-line) transition-[background-color] duration-120",
            interactive || hasActions ? "hover:bg-(--pn-muted)" : "hover:bg-transparent",
            interactive && "cursor-pointer",
            selectedRowId === id && "bg-(--pn-accent-soft) hover:bg-(--pn-accent-soft-hover)",
            extra?.className
          )}
        >
          {columns.map((column, index) => (
            <TableCell
              key={column.id}
              className={cn(
                "h-11 py-0 text-[13px] leading-5 text-(--pn-fg)",
                edgePadding(index, cellCount),
                index === 0 && "font-medium",
                column.mono && "font-mono tabular-nums",
                column.align === "end" && "text-right tabular-nums",
                column.fill && fillClass,
                hideClasses.get(column.id),
                column.className
              )}
            >
              {index === 0 ? renderFirstCell(href, column.cell(row)) : column.cell(row)}
            </TableCell>
          ))}
          {hasActions && (
            <TableCell
              className="h-11 w-px py-0 pr-5 pl-4"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <RowActions>{actions(row)}</RowActions>
            </TableCell>
          )}
        </TableRow>
      )
    })
  }

  return (
    <div
      className={cn(
        "@container overflow-hidden rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface) text-(--pn-fg)",
        className
      )}
    >
      <span role="status" className="sr-only">
        {loading ? loadingLabel : ""}
      </span>
      <Table aria-busy={loading || undefined}>
        <caption className="sr-only">{label}</caption>
        <TableHeader className="sticky top-0 z-[1] bg-(--pn-surface)">
          <TableRow className="border-(--pn-line) hover:bg-transparent">
            {columns.map((column, index) => {
              const direction = sort?.column === column.id ? sort.direction : null
              const sortable = column.sortable && onSort !== undefined
              return (
                <TableHead
                  key={column.id}
                  aria-sort={sortable ? (direction === null ? "none" : `${direction}ending`) : undefined}
                  className={cn(
                    "h-9 text-xs font-medium text-(--pn-fg-muted)",
                    sortable ? "p-0" : edgePadding(index, cellCount),
                    column.align === "end" && "text-right",
                    column.fill && fillClass,
                    hideClasses.get(column.id),
                    column.className
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.id)}
                      className={cn(
                        "group/sort flex h-9 w-full items-center gap-1 transition-[color] duration-120 hover:text-(--pn-fg)",
                        edgePadding(index, cellCount),
                        column.align === "end" && "justify-end"
                      )}
                    >
                      {column.align === "end" && <SortIcon direction={direction} />}
                      {column.label}
                      {column.align !== "end" && <SortIcon direction={direction} />}
                    </button>
                  ) : (
                    column.label
                  )}
                </TableHead>
              )
            })}
            {hasActions && (
              <TableHead className="h-9 w-px pr-5 pl-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>{renderBody()}</TableBody>
      </Table>
      {showPagination && <TablePaginationBar {...pagination} />}
    </div>
  )
}
