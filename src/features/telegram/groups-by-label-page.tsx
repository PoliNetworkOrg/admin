import { useMemo, useState } from "react"

import { DataToolbar } from "@/components/data-toolbar"
import { matchesLabelBranch } from "@/features/group-labels/label-tree"
import { CreateGroupDialog } from "@/features/telegram/create-group-dialog"
import { GroupsTable } from "@/features/telegram/groups-table"
import type { TgGroup, TgGroupLabel, TgGroupLabelRelation } from "@/lib/api/types"

export function GroupsByLabelPage({
  path,
  loadedGroups,
  loadedGroupLabels,
  loadedGroupLabelRelations,
}: {
  path: string
  loadedGroups: TgGroup[]
  loadedGroupLabels: TgGroupLabel[]
  loadedGroupLabelRelations: TgGroupLabelRelation[]
}) {
  const [query, setQuery] = useState("")

  const groupLabelsByName = useMemo(
    () => new Map(loadedGroupLabels.map((label) => [label.label, label])),
    [loadedGroupLabels]
  )

  const labelsByGroupId = useMemo(() => {
    const map = new Map<number, TgGroupLabel[]>()
    for (const relation of loadedGroupLabelRelations) {
      const label = groupLabelsByName.get(relation.label)
      if (!label) continue
      const existing = map.get(relation.groupId)
      if (existing) existing.push(label)
      else map.set(relation.groupId, [label])
    }
    return map
  }, [loadedGroupLabelRelations, groupLabelsByName])

  const branchGroups = useMemo(
    () => loadedGroups.filter((group) => matchesLabelBranch(labelsByGroupId.get(group.telegramId) ?? [], path)),
    [loadedGroups, labelsByGroupId, path]
  )

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase().replace(/^@/, "")
    if (!normalizedQuery) return branchGroups
    return branchGroups.filter((group) =>
      [group.title, group.tag].filter(Boolean).join(" ").toLocaleLowerCase().includes(normalizedQuery)
    )
  }, [branchGroups, query])

  const hasSearch = Boolean(query.trim())
  const labelExists = loadedGroupLabels.some((label) => label.label === path)

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Telegram"
        title={path}
        description={`Groups labeled "${path}" or with a more specific label nested under it.`}
        count={visibleGroups.length}
        total={branchGroups.length}
        searchPlaceholder="Search by group name or tag…"
        onSearch={setQuery}
        action={<CreateGroupDialog autoAssignLabel={path} autoAssignLabelExists={labelExists} />}
      />
      <GroupsTable
        groups={visibleGroups}
        allLabels={loadedGroupLabels}
        labelsByGroupId={labelsByGroupId}
        emptyTitle={hasSearch ? "No groups match this search" : `No groups labeled "${path}"`}
        emptyText={
          hasSearch
            ? "Clear the search and try again."
            : "No Telegram groups are tagged with this label or one nested under it yet."
        }
      />
    </div>
  )
}
