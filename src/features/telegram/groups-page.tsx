import { Tag } from "lucide-react"
import { useMemo, useState } from "react"

import { DataToolbar } from "@/components/data-toolbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { isSameGroupLabel } from "@/features/group-labels/group-labels.constants"
import { buildLabelsByGroupId } from "@/features/group-labels/label-tree"
import { LabelTreeSelector } from "@/features/group-labels/label-tree-selector"
import { GroupsTable } from "@/features/telegram/groups-table"
import type { GroupWithLabels, TgGroup, TgGroupLabel } from "@/lib/api/types"

function setManyGroupLabels(current: TgGroupLabel[], labels: TgGroupLabel[], select: boolean): TgGroupLabel[] {
  if (select) {
    const toAdd = labels.filter((label) => !current.some((existing) => isSameGroupLabel(existing, label)))
    return [...current, ...toAdd]
  }
  return current.filter((existing) => !labels.some((label) => isSameGroupLabel(existing, label)))
}

export function TelegramGroupsPage({
  loadedGroups,
  loadedGroupLabels,
  loadedGroupsWithLabels,
}: {
  loadedGroups: TgGroup[]
  loadedGroupLabels: TgGroupLabel[]
  loadedGroupsWithLabels: GroupWithLabels[]
}) {
  const [query, setQuery] = useState("")
  const [requiredLabels, setRequiredLabels] = useState<TgGroupLabel[]>([])
  const [excludedLabels, setExcludedLabels] = useState<TgGroupLabel[]>([])

  const labelsByGroupId = useMemo(
    () => buildLabelsByGroupId(loadedGroupLabels, loadedGroupsWithLabels, "tg"),
    [loadedGroupLabels, loadedGroupsWithLabels]
  )

  const visibleGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase().replace(/^@/, "")
    return loadedGroups.filter((group) => {
      const matchesText =
        !normalizedQuery ||
        [group.title, group.tag].filter(Boolean).join(" ").toLocaleLowerCase().includes(normalizedQuery)
      if (!matchesText) return false

      const groupLabels = labelsByGroupId.get(group.telegramId) ?? []
      const matchesRequired = requiredLabels.every((label) => groupLabels.some((gl) => gl.label === label.label))
      const matchesExcluded = excludedLabels.every((label) => !groupLabels.some((gl) => gl.label === label.label))
      return matchesRequired && matchesExcluded
    })
  }, [loadedGroups, query, requiredLabels, excludedLabels, labelsByGroupId])

  const activeLabelFilterCount = requiredLabels.length + excludedLabels.length
  const hasFilters = Boolean(query.trim()) || activeLabelFilterCount > 0

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Telegram"
        title="Telegram groups"
        description="Maintain the community groups connected to PoliNetwork."
        count={visibleGroups.length}
        total={loadedGroups.length}
        searchPlaceholder="Search by group name or tag…"
        onSearch={setQuery}
      >
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1.5">
                <Tag className="size-4" />
                Labels
                {activeLabelFilterCount > 0 && (
                  <Badge variant="secondary" className="h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
                    {activeLabelFilterCount}
                  </Badge>
                )}
              </Button>
            }
          />
          <PopoverContent align="start" className="w-80">
            <PopoverHeader>
              <PopoverTitle>Filter by label</PopoverTitle>
              <PopoverDescription>Show groups that must, or must not, have specific labels.</PopoverDescription>
            </PopoverHeader>
            {loadedGroupLabels.length ? (
              <>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Must have</p>
                  <LabelTreeSelector
                    allLabels={loadedGroupLabels.filter(
                      (label) => !excludedLabels.some((excluded) => isSameGroupLabel(excluded, label))
                    )}
                    selected={requiredLabels}
                    onToggleMany={(labels, select) =>
                      setRequiredLabels((current) => setManyGroupLabels(current, labels, select))
                    }
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Must not have</p>
                  <LabelTreeSelector
                    allLabels={loadedGroupLabels.filter(
                      (label) => !requiredLabels.some((required) => isSameGroupLabel(required, label))
                    )}
                    selected={excludedLabels}
                    onToggleMany={(labels, select) =>
                      setExcludedLabels((current) => setManyGroupLabels(current, labels, select))
                    }
                  />
                </div>
                {activeLabelFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start text-muted-foreground"
                    onClick={() => {
                      setRequiredLabels([])
                      setExcludedLabels([])
                    }}
                  >
                    Clear label filters
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No labels have been created yet.</p>
            )}
          </PopoverContent>
        </Popover>
      </DataToolbar>
      <GroupsTable
        groups={visibleGroups}
        allLabels={loadedGroupLabels}
        labelsByGroupId={labelsByGroupId}
        emptyTitle={hasFilters ? "No groups match this search" : "No Telegram groups yet"}
        emptyText={hasFilters ? "Clear the search or filters and try again." : "No Telegram groups were returned."}
      />
    </div>
  )
}
