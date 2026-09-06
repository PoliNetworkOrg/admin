import { Link } from "@tanstack/react-router"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"

import { DataToolbar } from "@/components/data-toolbar"
import { Button } from "@/components/ui/button"
import {
  buildCategoryRootTree,
  findLabelTreeNode,
  formatLabelBreadcrumb,
  formatLabelSegment,
  isCategoryLabel,
  labelPathToUrlSegments,
} from "@/features/group-labels/label-tree"
import { AddChildLabelDialog } from "@/features/groups-by-label/add-child-label-dialog"
import { AddGroupToLabelDialog } from "@/features/groups-by-label/add-group-to-label-dialog"
import { CombinedGroupsTable } from "@/features/groups-by-label/combined-groups-table"
import { useLabelGroupRows } from "@/features/groups-by-label/use-label-group-rows"
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

  const { tgLabelsByGroupId, waLabelsByGroupId, branchRows, visibleRows } = useLabelGroupRows({
    path,
    query,
    loadedTgGroups,
    loadedWaGroups,
    loadedGroupLabels,
    loadedGroupsWithLabels,
  })

  // Guarantees Didattica and Extra always appear, even with zero labels yet — otherwise an empty root would
  // have no card to click and no way back into it once it's the only path left to reach it.
  const categoryTree = useMemo(
    () => buildCategoryRootTree(loadedGroupLabels.filter((label) => isCategoryLabel(label.label))),
    [loadedGroupLabels]
  )
  // An empty path is the top of the tree (the "Categories" landing page) — its sub-categories are the tree's
  // own roots (Didattica, Extra), not a lookup, since there's no node for the empty path itself.
  const isRoot = path === ""
  const subCategories = useMemo(
    () => (isRoot ? categoryTree : (findLabelTreeNode(categoryTree, path)?.children ?? [])),
    [categoryTree, path, isRoot]
  )

  const hasSearch = Boolean(query.trim())
  const labelExists = loadedGroupLabels.some((label) => label.label === path)
  const segments = labelPathToUrlSegments(path)
  const title = isRoot ? "Categories" : formatLabelSegment(segments[segments.length - 1] ?? path)
  const eyebrow = segments.length > 1 ? formatLabelBreadcrumb(segments.slice(0, -1).join(".")) : "Web"

  // At a top-level category (Didattica, Extra) "up" goes back to the Categories landing page (the Didattica/Extra
  // picker), not to the Group labels management page — browsing and managing are two separate destinations now
  // that there's no sidebar tree to jump around the hierarchy with.
  const parentSegments = segments.slice(0, -1)
  const backUrl: string = parentSegments.length
    ? `/dashboard/web/groups-by-label/${parentSegments.join("/")}`
    : "/dashboard/web/groups-by-label"
  const backLabel = parentSegments.length ? formatLabelSegment(parentSegments[parentSegments.length - 1]) : "Categories"

  return (
    <div className="animate-appear">
      {!isRoot && (
        <Button
          variant="ghost"
          size="sm"
          render={<Link to={backUrl} />}
          nativeButton={false}
          className="-ml-2 mb-2 w-fit gap-1 text-muted-foreground"
        >
          <ArrowLeft data-icon="inline-start" className="size-3.5" /> Back to {backLabel}
        </Button>
      )}
      <DataToolbar
        eyebrow={eyebrow}
        title={title}
        description={
          isRoot
            ? "Browse groups by category — pick Didattica or Extra to drill in."
            : `Groups tagged directly with "${formatLabelBreadcrumb(path)}".`
        }
        count={isRoot ? subCategories.length : visibleRows.length}
        total={isRoot ? subCategories.length : branchRows.length}
        searchPlaceholder={isRoot ? undefined : "Search by group name or tag…"}
        onSearch={isRoot ? undefined : setQuery}
        action={
          isRoot ? undefined : (
            <div className="flex items-center gap-2">
              <AddChildLabelDialog path={path} />
              <AddGroupToLabelDialog
                path={path}
                labelExists={labelExists}
                allLabels={loadedGroupLabels}
                tgGroups={loadedTgGroups}
                waGroups={loadedWaGroups}
                tgLabelsByGroupId={tgLabelsByGroupId}
                waLabelsByGroupId={waLabelsByGroupId}
              />
            </div>
          )
        }
      />

      {subCategories.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-foreground/85">{isRoot ? "Categories" : "Sub-categories"}</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {subCategories.map((child) => {
              const childUrl: string = `/dashboard/web/groups-by-label/${labelPathToUrlSegments(child.path).join("/")}`
              return (
                <Link
                  key={child.path}
                  to={childUrl}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:border-primary/50 hover:bg-accent"
                >
                  <span className="truncate">{formatLabelSegment(child.segment)}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {!isRoot && (
        <>
          {subCategories.length > 0 && <h2 className="mb-2 text-sm font-semibold text-foreground/85">Groups</h2>}
          <CombinedGroupsTable
            rows={visibleRows}
            allLabels={loadedGroupLabels}
            emptyTitle={
              hasSearch ? "No groups match this search" : `No groups labeled "${formatLabelBreadcrumb(path)}"`
            }
            emptyText={
              hasSearch
                ? "Clear the search and try again."
                : subCategories.length > 0
                  ? "No groups are tagged with this exact category — check the sub-categories above."
                  : "No groups are tagged with this category yet."
            }
          />
        </>
      )}
    </div>
  )
}
