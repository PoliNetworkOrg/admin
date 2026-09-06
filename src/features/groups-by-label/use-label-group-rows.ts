import { useMemo } from "react"

import { buildLabelsByGroupId, hasExactLabel } from "@/features/group-labels/label-tree"
import type { CombinedGroupRow } from "@/features/groups-by-label/combined-groups-table"
import type { GroupWithLabels, TgGroup, TgGroupLabel, WaGroup } from "@/lib/api/types"

/**
 * The rows for one label's page, shared by the category browser and by a flat tag's page — the two differ in
 * chrome (sub-categories, which dialogs are offered) but derive their groups identically, so an exact-label
 * page always lists exactly what its publish/label actions will act on.
 */
export function useLabelGroupRows({
  path,
  query,
  loadedTgGroups,
  loadedWaGroups,
  loadedGroupLabels,
  loadedGroupsWithLabels,
}: {
  path: string
  query: string
  loadedTgGroups: TgGroup[]
  loadedWaGroups: WaGroup[]
  loadedGroupLabels: TgGroupLabel[]
  loadedGroupsWithLabels: GroupWithLabels[]
}) {
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

  // Only groups tagged with this exact label — for a category, a level below shows up as a sub-category to click
  // into, not mixed into this list, so the admin always knows precisely where a group is filed. Flat tags never
  // nest, so for them exact matching is the only meaning available.
  const branchRows = useMemo(() => {
    const tgRows: CombinedGroupRow[] = loadedTgGroups
      .filter((group) => hasExactLabel(tgLabelsByGroupId.get(group.telegramId) ?? [], path))
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
      .filter((group) => hasExactLabel(waLabelsByGroupId.get(group.id) ?? [], path))
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

  return { tgLabelsByGroupId, waLabelsByGroupId, branchRows, visibleRows }
}
