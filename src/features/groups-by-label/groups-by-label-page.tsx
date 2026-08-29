import { useMemo, useState } from "react"

import { DataToolbar } from "@/components/data-toolbar"
import { buildLabelsByGroupId, labelPathToUrlSegments, matchesLabelBranch } from "@/features/group-labels/label-tree"
import { AddChildLabelDialog } from "@/features/groups-by-label/add-child-label-dialog"
import { AddGroupToLabelDialog } from "@/features/groups-by-label/add-group-to-label-dialog"
import { CombinedGroupsTable, type CombinedGroupRow } from "@/features/groups-by-label/combined-groups-table"
import type { GroupWithLabels, TgGroup, TgGroupLabel, WaGroup } from "@/lib/api/types"

export function GroupsByLabelPage({
  path,
  loadedTgGroups,
  loadedGroupLabels,
  loadedGroupsWithLabels,
  loadedWaGroups,
}: {
  path: string
  loadedTgGroups: TgGroup[]
  loadedGroupLabels: TgGroupLabel[]
  loadedGroupsWithLabels: GroupWithLabels[]
  loadedWaGroups: WaGroup[]
}) {
  const [query, setQuery] = useState("")

  // Kept as two separate maps (not merged into one) since Telegram and WhatsApp group ids are independent
  // sequences that could otherwise collide.
  const tgLabelsByGroupId = useMemo(
    () => buildLabelsByGroupId(loadedGroupLabels, loadedGroupsWithLabels, "tg"),
    [loadedGroupLabels, loadedGroupsWithLabels]
  )
  const waLabelsByGroupId = useMemo(
    () => buildLabelsByGroupId(loadedGroupLabels, loadedGroupsWithLabels, "wa"),
    [loadedGroupLabels, loadedGroupsWithLabels]
  )

  const branchRows = useMemo(() => {
    const tgRows: CombinedGroupRow[] = loadedTgGroups
      .filter((group) => matchesLabelBranch(tgLabelsByGroupId.get(group.telegramId) ?? [], path))
      .map((group) => ({
        key: `telegram-${group.telegramId}`,
        platform: "telegram",
        title: group.title,
        tag: group.tag,
        link: group.link,
        labels: tgLabelsByGroupId.get(group.telegramId) ?? [],
        group,
      }))

    const waRows: CombinedGroupRow[] = loadedWaGroups
      .filter((group) => matchesLabelBranch(waLabelsByGroupId.get(group.id) ?? [], path))
      .map((group) => ({
        key: `whatsapp-${group.id}`,
        platform: "whatsapp",
        title: group.title,
        tag: null,
        link: group.link,
        labels: waLabelsByGroupId.get(group.id) ?? [],
        group,
      }))

    return [...tgRows, ...waRows]
  }, [loadedTgGroups, loadedWaGroups, tgLabelsByGroupId, waLabelsByGroupId, path])

  const visibleRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase().replace(/^@/, "")
    if (!normalizedQuery) return branchRows
    return branchRows.filter((row) =>
      [row.title, row.tag].filter(Boolean).join(" ").toLocaleLowerCase().includes(normalizedQuery)
    )
  }, [branchRows, query])

  const hasSearch = Boolean(query.trim())
  const labelExists = loadedGroupLabels.some((label) => label.label === path)
  const segments = labelPathToUrlSegments(path)
  const title = segments[segments.length - 1] ?? path
  const eyebrow = segments.length > 1 ? segments.slice(0, -1).join(".") : "Groups by category"

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow={eyebrow}
        title={title}
        description={`Groups labeled "${path}" or with a more specific category nested under it.`}
        count={visibleRows.length}
        total={branchRows.length}
        searchPlaceholder="Search by group name or tag…"
        onSearch={setQuery}
        action={
          <div className="flex items-center gap-2">
            <AddChildLabelDialog path={path} />
            <AddGroupToLabelDialog
              path={path}
              labelExists={labelExists}
              tgGroups={loadedTgGroups}
              waGroups={loadedWaGroups}
              tgLabelsByGroupId={tgLabelsByGroupId}
              waLabelsByGroupId={waLabelsByGroupId}
            />
          </div>
        }
      />
      <CombinedGroupsTable
        rows={visibleRows}
        allLabels={loadedGroupLabels}
        emptyTitle={hasSearch ? "No groups match this search" : `No groups labeled "${path}"`}
        emptyText={
          hasSearch
            ? "Clear the search and try again."
            : "No groups are tagged with this label or one nested under it yet."
        }
      />
    </div>
  )
}
