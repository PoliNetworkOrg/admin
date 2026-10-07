import { Database, Plus } from "lucide-react"
import { useMemo, useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  GroupLabelBadges,
  SegmentedControl,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCanWrite } from "@/components/shell"
import { Button } from "@/components/ui/button"
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
  useRefreshGroups,
} from "@/features/groups/group-row-actions"
import {
  compareText,
  LabelsFilterPopover,
  matchesLabelFilter,
  sortRows,
  useGroupListState,
} from "@/features/groups/labels-filter-popover"
import { matchesVisibility, VISIBILITY_FILTERS, type VisibilityFilter } from "@/features/groups/visibility"
import { WhatsappGroupDialog } from "@/features/whatsapp/whatsapp-group-dialog"
import type { GroupWithLabels, WaGroup } from "@/lib/api/types"

type WhatsappGroupsPageProps = {
  groups: WaGroup[]
  labels: GroupLabel[]
  groupsWithLabels: GroupWithLabels[]
  initialQuery: string
  visibility: VisibilityFilter
  onVisibilityChange: (visibility: VisibilityFilter) => void
}

/** WhatsApp › Groups (§7.7): manually registered groups with visibility, labels, edit and delete. */
export function WhatsappGroupsPage({
  groups,
  labels,
  groupsWithLabels,
  initialQuery,
  visibility,
  onVisibilityChange,
}: WhatsappGroupsPageProps) {
  const canWrite = useCanWrite("web")
  const refresh = useRefreshGroups()
  const labelsByPath = useLabelsByPath(labels)
  const list = useGroupListState({
    defaultSort: { column: "title", direction: "asc" },
    urlQuery: initialQuery,
    visibility,
    onVisibilityChange,
  })
  const [creating, setCreating] = useState(false)

  // `wa.groups.getAll` is the list; the cross-platform search adds each group's label paths.
  const all = useMemo(() => {
    const labelsById = new Map(
      groupsWithLabels.filter((group) => group.type === "wa").map((group) => [group.id, group.labels])
    )
    return groups.map((group): GroupWithLabels => ({
      type: "wa",
      id: group.id,
      title: group.title,
      link: group.link,
      hide: group.hide,
      labels: labelsById.get(group.id) ?? [],
    }))
  }, [groups, groupsWithLabels])
  const groupActions = useGroupActions(labels, all)

  const { deferredQuery, filter, sort } = list
  const matching = useMemo(() => {
    const filtered = all.filter(
      (group) =>
        group.title.toLocaleLowerCase().includes(deferredQuery) &&
        matchesVisibility(group.hide, visibility) &&
        matchesLabelFilter(group.labels, filter)
    )
    return sortRows(filtered, (a, b) => compareText(a.title, b.title), sort.direction)
  }, [all, deferredQuery, filter, sort, visibility])

  const { rows, pagination } = list.paginate(matching)

  const columns: DataTableColumn<GroupWithLabels>[] = [
    {
      id: "title",
      label: "Group",
      sortable: true,
      // 240px of title plus cell padding.
      minWidth: 276,
      fill: true,
      cell: (row) => (
        <span title={row.title} className="block truncate">
          {row.title}
        </span>
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

  // The empty state repeats the header primary as outline (§8.4).
  const addGroup = (variant: "default" | "outline") => (
    <Button variant={variant} size="sm" onClick={() => setCreating(true)} className={buttonMotion}>
      <Plus aria-hidden data-icon="inline-start" />
      Add group
    </Button>
  )

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
    <EmptyState
      icon={Database}
      title="No WhatsApp groups yet"
      text="Add the first WhatsApp group to list it on the site."
      action={canWrite ? addGroup("outline") : undefined}
    />
  )

  return (
    <>
      <PageBar
        left={
          <Toolbar
            search={{ value: list.query, onChange: list.setQuery, placeholder: "Search by group name…" }}
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
        right={canWrite ? addGroup("default") : undefined}
      />
      <PageContent width="wide">
        <DataTable
          className={canWrite ? mobileGroupTableClasses : undefined}
          label="WhatsApp groups"
          columns={columns}
          rows={rows}
          getRowId={groupKey}
          sort={sort}
          onSort={list.setSort}
          actions={(row) => <GroupRowActions group={row} controller={groupActions} canWrite={canWrite} />}
          actionsWidth={groupActionsWidth(5, canWrite)}
          pagination={pagination}
          empty={empty}
        />
        {groupActions.dialogs}
        {canWrite && (
          <WhatsappGroupDialog
            open={creating}
            onOpenChange={setCreating}
            onSaved={() => refresh("The group was saved, but the group list could not be refreshed.")}
          />
        )}
      </PageContent>
    </>
  )
}
