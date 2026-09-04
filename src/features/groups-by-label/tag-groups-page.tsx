import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"

import { DataToolbar } from "@/components/data-toolbar"
import { Button } from "@/components/ui/button"
import { formatLabelSegment } from "@/features/group-labels/label-tree"
import { AddGroupToLabelDialog } from "@/features/groups-by-label/add-group-to-label-dialog"
import { CombinedGroupsTable } from "@/features/groups-by-label/combined-groups-table"
import { PublishTagGroupsDialog } from "@/features/groups-by-label/publish-tag-groups-dialog"
import { useLabelGroupRows } from "@/features/groups-by-label/use-label-group-rows"
import type { GroupWithLabels, TgGroup, TgGroupLabel, WaGroup } from "@/lib/api/types"

/**
 * One flat tag's groups. Tags sit outside the category hierarchy (see CATEGORY_ROOTS in label-tree.ts), so they
 * get a flat page of their own rather than a node in the browsable tree: no sub-categories to drill into, and no
 * "add sub-category", which the label validator would reject under a tag anyway.
 */
export function TagGroupsPage({
  tag,
  loadedTgGroups,
  loadedGroupLabels,
  loadedGroupsWithLabels,
  loadedWaGroups,
}: {
  tag: string
  loadedTgGroups: TgGroup[]
  loadedGroupLabels: TgGroupLabel[]
  loadedGroupsWithLabels: GroupWithLabels[]
  loadedWaGroups: WaGroup[]
}) {
  const [query, setQuery] = useState("")

  const { tgLabelsByGroupId, waLabelsByGroupId, branchRows, visibleRows } = useLabelGroupRows({
    path: tag,
    query,
    loadedTgGroups,
    loadedWaGroups,
    loadedGroupLabels,
    loadedGroupsWithLabels,
  })

  const hasSearch = Boolean(query.trim())
  const labelExists = loadedGroupLabels.some((label) => label.label === tag)
  const title = formatLabelSegment(tag)
  const backUrl: string = "/dashboard/web/group-labels"

  return (
    <div className="animate-appear">
      <Button
        variant="ghost"
        size="sm"
        render={<Link to={backUrl} />}
        nativeButton={false}
        className="-ml-2 mb-2 w-fit gap-1 text-muted-foreground"
      >
        <ArrowLeft data-icon="inline-start" className="size-3.5" /> Back to Group labels
      </Button>
      <DataToolbar
        eyebrow="Web"
        title={title}
        description={`Groups tagged "${title}".`}
        count={visibleRows.length}
        total={branchRows.length}
        searchPlaceholder="Search by group name or tag…"
        onSearch={setQuery}
        action={
          <div className="flex items-center gap-2">
            {/* Publishing acts on the whole tag, not on what the search box currently shows. */}
            <PublishTagGroupsDialog tag={tag} rows={branchRows} />
            <AddGroupToLabelDialog
              path={tag}
              labelExists={labelExists}
              // A group created here would carry this tag and no category, so after it's published — and the tag
              // removed — it would sit on the site uncategorized. Groups are born on a category page instead.
              allowCreate={false}
              allLabels={loadedGroupLabels}
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
        emptyTitle={hasSearch ? "No groups match this search" : `No groups tagged "${title}"`}
        emptyText={hasSearch ? "Clear the search and try again." : "Add existing groups to this tag to start using it."}
      />
    </div>
  )
}
