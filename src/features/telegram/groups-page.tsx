import { Database } from "lucide-react"
import { useMemo } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  GroupLabelBadges,
  SegmentedControl,
  Unset,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCanWrite } from "@/components/shell"
import { Button } from "@/components/ui/button"
import type { GroupLabel } from "@/features/group-labels/types"
import {
  groupActionsWidth,
  GroupRowActions,
  groupKey,
  labelLink,
  resolveLabels,
  useGroupActions,
  useLabelsByPath,
} from "@/features/groups/group-row-actions"
import {
  compareText,
  LabelsFilterPopover,
  matchesLabelFilter,
  sortRows,
  useGroupListState,
} from "@/features/groups/labels-filter-popover"
import { matchesVisibility, VISIBILITY_FILTERS, type VisibilityFilter } from "@/features/groups/visibility"
import type { GroupWithLabels, TgGroup } from "@/lib/api/types"

type TelegramGroupRow = GroupWithLabels & { tag: string | null }

function comparatorFor(column: string): (a: TelegramGroupRow, b: TelegramGroupRow) => number {
  if (column === "telegramId") return (a, b) => a.id - b.id
  if (column === "tag") return (a, b) => compareText(a.tag ?? "", b.tag ?? "")
  return (a, b) => compareText(a.title, b.title)
}

type TelegramGroupsPageProps = {
  groups: TgGroup[]
  labels: GroupLabel[]
  groupsWithLabels: GroupWithLabels[]
  initialQuery: string
  visibility: VisibilityFilter
  onVisibilityChange: (visibility: VisibilityFilter) => void
}

/** Telegram › Groups (§7.6): bot-managed groups with visibility, labels and leave. */
export function TelegramGroupsPage({
  groups,
  labels,
  groupsWithLabels,
  initialQuery,
  visibility,
  onVisibilityChange,
}: TelegramGroupsPageProps) {
  const canWrite = useCanWrite("web")
  const labelsByPath = useLabelsByPath(labels)
  const list = useGroupListState({
    defaultSort: { column: "title", direction: "asc" },
    urlQuery: initialQuery,
    visibility,
    onVisibilityChange,
  })

  // `tg.groups.getAll` is the list; the cross-platform search adds each group's label paths.
  const all = useMemo(() => {
    const labelsById = new Map(
      groupsWithLabels.filter((group) => group.type === "tg").map((group) => [group.id, group.labels])
    )
    return groups.map((group): TelegramGroupRow => ({
      type: "tg",
      id: group.telegramId,
      title: group.title,
      link: group.link,
      hide: group.hide,
      labels: labelsById.get(group.telegramId) ?? [],
      tag: group.tag,
    }))
  }, [groups, groupsWithLabels])
  const groupActions = useGroupActions(labels, all)

  const { deferredQuery, filter, sort } = list
  const matching = useMemo(() => {
    const query = deferredQuery.replace(/^@/, "")
    const filtered = all.filter(
      (group) =>
        [group.title, group.tag].join(" ").toLocaleLowerCase().includes(query) &&
        matchesVisibility(group.hide, visibility) &&
        matchesLabelFilter(group.labels, filter)
    )
    return sortRows(
      filtered,
      comparatorFor(sort.column),
      sort.direction,
      (row) => sort.column === "tag" && row.tag === null
    )
  }, [all, deferredQuery, filter, sort, visibility])

  const { rows, pagination } = list.paginate(matching)

  const columns: DataTableColumn<TelegramGroupRow>[] = [
    {
      id: "title",
      label: "Group",
      sortable: true,
      // 208px of title plus cell padding.
      minWidth: 244,
      fill: true,
      cell: (row) => (
        <span title={row.title} className="block truncate">
          {row.title}
        </span>
      ),
    },
    {
      id: "telegramId",
      label: "Telegram ID",
      sortable: true,
      mono: true,
      priority: 2,
      minWidth: 146,
      cell: (row) => row.id,
    },
    {
      id: "tag",
      label: "Tag",
      sortable: true,
      mono: true,
      priority: 3,
      minWidth: 176,
      cell: (row) =>
        row.tag ? (
          <span title={`@${row.tag}`} className="block truncate">
            @{row.tag}
          </span>
        ) : (
          <Unset />
        ),
    },
    {
      id: "labels",
      label: "Labels",
      priority: 1,
      minWidth: 290,
      cell: (row) => <GroupLabelBadges labels={resolveLabels(row.labels, labelsByPath)} renderLink={labelLink} />,
    },
  ]

  const empty = list.filtering ? (
    <EmptyState
      icon={Database}
      title="No groups match"
      text="Clear the search or filters and try again."
      action={
        <Button variant="ghost" size="sm" onClick={list.clear} className={buttonMotion}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState icon={Database} title="No Telegram groups yet" text="Groups appear here once the bot joins them." />
  )

  return (
    <>
      <PageBar
        left={
          <Toolbar
            search={{ value: list.query, onChange: list.setQuery, placeholder: "Search by group name or tag…" }}
            filters={
              <>
                <LabelsFilterPopover labels={labels} value={filter} onChange={list.setFilter} />
                <SegmentedControl
                  label="Visibility"
                  items={VISIBILITY_FILTERS}
                  value={visibility}
                  onValueChange={list.setVisibility}
                />
              </>
            }
            count={<Count value={matching.length} total={list.filtering ? all.length : undefined} noun="group" />}
          />
        }
      />
      <PageContent width="wide">
        <DataTable
          label="Telegram groups"
          columns={columns}
          rows={rows}
          getRowId={groupKey}
          sort={sort}
          onSort={list.setSort}
          actions={(row) => <GroupRowActions group={row} controller={groupActions} canWrite={canWrite} />}
          actionsWidth={groupActionsWidth(4, canWrite)}
          pagination={pagination}
          empty={empty}
        />
        {groupActions.dialogs}
      </PageContent>
    </>
  )
}
