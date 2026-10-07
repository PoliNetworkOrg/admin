import { Link } from "@tanstack/react-router"
import { FolderTree, Plus } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import { buttonMotion, EmptyState, NavCard, RecordHeader, SectionHeading } from "@/components/primitives"
import { PageBar, PageContent, SearchField, useCanWrite } from "@/components/shell"
import { Button } from "@/components/ui/button"
import {
  buildCategoryRootTree,
  countBranchGroups,
  findLabelTreeNode,
  formatLabelBreadcrumb,
  formatLabelSegment,
  isCategoryLabel,
  labelPathToUrlSegments,
} from "@/features/group-labels/label-tree"
import type { GroupLabel } from "@/features/group-labels/types"
import type { GroupWithLabels, TgGroup } from "@/lib/api/types"
import { formatNumber, pluralize } from "@/lib/format"

import { AddChildLabelDialog } from "./add-child-label-dialog"
import { AddGroupToLabelDialog } from "./add-group-to-label-dialog"
import { CombinedGroupsTable } from "./combined-groups-table"
import { GROUP_SEARCH_PLACEHOLDER, useLabelGroups } from "./label-groups"

type CategoryPageProps = {
  /** Dotted category path, e.g. "didattica.ingegneria.informatica". */
  path: string
  labels: GroupLabel[]
  groups: GroupWithLabels[]
  tgGroups: TgGroup[]
}

function categoryPath(path: string) {
  return { _splat: labelPathToUrlSegments(path).join("/") }
}

/** One category node: its sub-categories as cards, then the groups tagged with exactly this category. */
export function CategoryPage({ path, labels, groups, tgGroups }: CategoryPageProps) {
  const canWrite = useCanWrite("web")
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [query, setQuery] = useState("")
  const [childOpen, setChildOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)

  const node = useMemo(
    () =>
      isCategoryLabel(path)
        ? findLabelTreeNode(buildCategoryRootTree(labels.filter((label) => isCategoryLabel(label.label))), path)
        : undefined,
    [labels, path]
  )
  const { rows, visible, searching } = useLabelGroups({ label: path, query, groups, tgGroups })

  if (!node) {
    return (
      <>
        <PageBar back={{ label: "categories", link: { to: "/dashboard/web/groups-by-label" } }} context="Categories" />
        <PageContent width="wide">
          <h1 className="sr-only">Category not found</h1>
          <EmptyState
            icon={FolderTree}
            title="Category not found"
            text="It may have been renamed or deleted."
            action={
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link to="/dashboard/web/groups-by-label" />}
                className={buttonMotion}
              >
                Go to categories
              </Button>
            }
          />
        </PageContent>
      </>
    )
  }

  const segments = labelPathToUrlSegments(path)
  const parentPath = segments.slice(0, -1).join(".")
  const title = formatLabelSegment(node.segment)
  const breadcrumb = formatLabelBreadcrumb(path)
  const groupLabels = groups.map((group) => group.labels)
  // Sub-category cards count their whole branch; the meta states both rules so the numbers add up.
  const nestedCount = groupLabels.filter((paths) => paths.some((label) => label.startsWith(`${path}.`))).length

  // The empty state repeats the header primary as outline (§8.4).
  const addGroupButton = (variant: "default" | "outline") => (
    <Button variant={variant} size="sm" onClick={() => setGroupOpen(true)} className={buttonMotion}>
      <Plus aria-hidden data-icon="inline-start" />
      Add group
    </Button>
  )

  const bar = {
    context: parentPath ? formatLabelBreadcrumb(parentPath) : "Categories",
    scrollTitleRef: titleRef,
    scrollTitle: title,
    right: canWrite && (
      <>
        <Button variant="outline" size="sm" onClick={() => setChildOpen(true)} className={buttonMotion}>
          <Plus aria-hidden data-icon="inline-start" />
          Add category
        </Button>
        {addGroupButton("default")}
      </>
    ),
  }

  return (
    <>
      {parentPath ? (
        <PageBar
          back={{
            label: formatLabelSegment(segments.at(-2) ?? parentPath),
            link: { to: "/dashboard/web/groups-by-label/$", params: categoryPath(parentPath) },
          }}
          {...bar}
        />
      ) : (
        <PageBar back={{ label: "categories", link: { to: "/dashboard/web/groups-by-label" } }} {...bar} />
      )}
      <PageContent width="wide">
        <div className="flex flex-col gap-8">
          <RecordHeader
            titleRef={titleRef}
            title={title}
            dot={node.label?.color}
            meta={
              <span className="tabular-nums">
                {pluralize(rows.length, "group")} tagged directly
                {node.children.length > 0 && ` · ${formatNumber(nestedCount)} in sub-categories`}
              </span>
            }
            description={node.label?.description}
          />

          {node.children.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="category-children">
              <SectionHeading id="category-children" title="Sub-categories" count={node.children.length} />
              <nav aria-label="Sub-categories" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {node.children.map((child) => (
                  <NavCard
                    key={child.path}
                    title={formatLabelSegment(child.segment)}
                    count={countBranchGroups(groupLabels, child.path)}
                    noun="group"
                    render={<Link to="/dashboard/web/groups-by-label/$" params={categoryPath(child.path)} />}
                  />
                ))}
              </nav>
            </section>
          )}

          <section className="flex flex-col gap-3" aria-labelledby="category-groups">
            <SectionHeading
              id="category-groups"
              title="Groups"
              action={
                <SearchField
                  value={query}
                  onChange={setQuery}
                  placeholder={GROUP_SEARCH_PLACEHOLDER}
                  className="w-70"
                />
              }
            />
            <CombinedGroupsTable
              rows={visible}
              labels={labels}
              tgGroups={tgGroups}
              canWrite={canWrite}
              empty={
                searching ? (
                  <EmptyState
                    icon={FolderTree}
                    title="No groups match"
                    text="Try a different group name or tag."
                    action={
                      <Button variant="ghost" size="sm" onClick={() => setQuery("")} className={buttonMotion}>
                        Clear search
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={FolderTree}
                    title={`No groups labeled ${breadcrumb}`}
                    text={
                      node.children.length > 0
                        ? "Check the sub-categories above or add a group."
                        : "No groups are tagged with this category yet."
                    }
                    action={canWrite && addGroupButton("outline")}
                  />
                )
              }
            />
          </section>
        </div>
      </PageContent>

      <AddChildLabelDialog open={childOpen} onOpenChange={setChildOpen} path={path} navigateOnSuccess />
      <AddGroupToLabelDialog
        open={groupOpen}
        onOpenChange={setGroupOpen}
        path={path}
        labels={labels}
        groups={groups}
        tgGroups={tgGroups}
      />
    </>
  )
}
