import { useDeferredValue, useMemo } from "react"

import type { GroupWithLabels, TgGroup } from "@/lib/api/types"

export const GROUP_SEARCH_PLACEHOLDER = "Search by group name or tag…"

/** Telegram tags by group id, for searching and showing `@tag` next to cross-platform rows. */
export function useTelegramTags(tgGroups: TgGroup[]) {
  return useMemo(() => new Map(tgGroups.map((group) => [group.telegramId, group.tag ?? ""])), [tgGroups])
}

/** Title plus, for Telegram groups, the tag: what the group searches match against. */
export function groupSearchText(group: GroupWithLabels, tags: Map<number, string>) {
  const tag = group.type === "tg" ? (tags.get(group.id) ?? "") : ""
  return `${group.title} ${tag}`.toLocaleLowerCase()
}

/** Lower-cased query without a leading `@`, so "@am1" finds the tag "am1". */
export function normalizeGroupQuery(query: string) {
  return query.trim().toLocaleLowerCase().replace(/^@/, "")
}

/**
 * Groups tagged with exactly `label` (a category one level down is a sub-category card, not a row here), plus the
 * search-filtered subset. Publishing and the empty state act on `rows`, never on the filtered subset.
 */
export function useLabelGroups({
  label,
  query,
  groups,
  tgGroups,
}: {
  label: string
  query: string
  groups: GroupWithLabels[]
  tgGroups: TgGroup[]
}) {
  const tags = useTelegramTags(tgGroups)
  const deferredQuery = useDeferredValue(query)

  return useMemo(() => {
    const rows = groups.filter((group) => group.labels.includes(label))
    const normalized = normalizeGroupQuery(deferredQuery)
    const visible = normalized ? rows.filter((group) => groupSearchText(group, tags).includes(normalized)) : rows
    return { rows, visible, searching: normalized !== "" }
  }, [groups, tags, label, deferredQuery])
}
