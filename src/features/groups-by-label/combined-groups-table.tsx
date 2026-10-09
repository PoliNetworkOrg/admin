import { type ReactNode, useMemo, useState } from "react"

import {
  CopyableText,
  DataTable,
  type DataTableColumn,
  GroupLabelBadges,
  PAGE_SIZES,
  PlatformGlyph,
  type TableSort,
  Unset,
} from "@/components/primitives"
import type { GroupLabel } from "@/features/group-labels/types"
import {
  groupActionsWidth,
  GroupRowActions,
  groupKey,
  labelLink,
  mobileGroupTableClasses,
  resolveLabels,
  useGroupActions,
  useLabelsByPath,
} from "@/features/groups/group-row-actions"
import { compareText, sortRows } from "@/features/groups/labels-filter-popover"
import type { GroupWithLabels, TgGroup } from "@/lib/api/types"

type CombinedRow = GroupWithLabels & { tag: string | null }

type CombinedGroupsTableProps = {
  /** Telegram and WhatsApp groups, already filtered by the page. */
  rows: GroupWithLabels[]
  empty: ReactNode
  canWrite: boolean
  /** Every label, from `listGroupLabels`: resolves the label chips and feeds the "Edit labels" picker. */
  labels: GroupLabel[]
  /** Telegram groups (`listGroupsForLabels().tgGroups` or `getTelegramGroups`), for the Tag column. */
  tgGroups: Pick<TgGroup, "telegramId" | "tag">[]
  search: string
}

/**
 * Telegram + WhatsApp groups in one table with the per-platform row actions. The
 * categories and tag pages pass rows and an empty state; mutations reload the route through `router.invalidate()`.
 */
export function CombinedGroupsTable({ rows, empty, canWrite, labels, tgGroups, search }: CombinedGroupsTableProps) {
  const labelsByPath = useLabelsByPath(labels)
  const groupActions = useGroupActions(labels, rows)
  const [sort, setSort] = useState<TableSort>({ column: "title", direction: "asc" })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [previousSearch, setPreviousSearch] = useState(search)
  if (previousSearch !== search) {
    setPreviousSearch(search)
    setPage(1)
  }

  const sorted = useMemo(() => {
    const tags = new Map(tgGroups.map((group) => [group.telegramId, group.tag]))
    const withTags = rows.map((row): CombinedRow => ({
      ...row,
      tag: row.type === "tg" ? (tags.get(row.id) ?? null) : null,
    }))
    if (sort.column === "tag") {
      return sortRows(
        withTags,
        (a, b) => compareText(a.tag ?? "", b.tag ?? ""),
        sort.direction,
        (row) => !row.tag
      )
    }
    return sortRows(withTags, (a, b) => compareText(a.title, b.title), sort.direction)
  }, [rows, tgGroups, sort])

  // The page keeps its position when rows change (a toggle, a save); it only clamps when rows disappear.
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, pageCount)
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize)
  const mixed = rows.some((row) => row.type === "tg") && rows.some((row) => row.type === "wa")

  const columns: DataTableColumn<CombinedRow>[] = [
    {
      id: "title",
      label: "Group",
      sortable: true,
      // Glyph, gap and 224px of title plus cell padding.
      minWidth: 282,
      fill: true,
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2">
          <PlatformGlyph platform={row.type} />
          <span title={row.title} className="min-w-0 truncate">
            {row.title}
          </span>
        </span>
      ),
    },
    {
      id: "tag",
      label: "Tag",
      sortable: true,
      mono: true,
      priority: 2,
      width: 176,
      cell: (row) =>
        row.tag ? (
          <CopyableText value={row.tag} what="Tag">
            @{row.tag}
          </CopyableText>
        ) : (
          <Unset />
        ),
    },
    {
      id: "labels",
      label: "Labels",
      priority: 1,
      width: 320,
      cell: (row) => <GroupLabelBadges labels={resolveLabels(row.labels, labelsByPath)} renderLink={labelLink} />,
    },
  ]

  return (
    <>
      <div ref={groupActions.surfaceRef} tabIndex={-1} className="rounded-(--pn-r-4)">
        <DataTable
          className={canWrite ? mobileGroupTableClasses : undefined}
          label="Groups"
          columns={columns}
          rows={visible}
          getRowId={groupKey}
          sort={sort}
          onSort={(next) => {
            setSort(next)
            setPage(1)
          }}
          actions={(row) => (
            <GroupRowActions group={row} controller={groupActions} canWrite={canWrite} alignEdit={mixed} />
          )}
          actionsWidth={groupActionsWidth(rows.some((row) => row.type === "wa") ? 4 : 3, canWrite)}
          pagination={{
            page: current,
            pageSize,
            total: sorted.length,
            onPage: setPage,
            onPageSize: (size) => {
              setPageSize(size)
              setPage(1)
            },
          }}
          empty={empty}
        />
      </div>
      {groupActions.dialogs}
    </>
  )
}
