import { FolderTree, Plus, Tags } from "lucide-react"
import { useMemo, useState } from "react"

import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"

import { AddCategoryDialog } from "./add-category-dialog"
import { AddTagDialog } from "./add-tag-dialog"
import { GroupLabelCard } from "./group-label-card"
import { GroupLabelTreeRow } from "./group-label-tree-row"
import {
  buildCategoryRootTree,
  filterFlatLabels,
  filterLabelTree,
  isCategoryLabel,
  type LabelTreeNode,
} from "./label-tree"
import type { GroupLabel } from "./types"
import { useGroupLabelRows } from "./use-group-label-rows"

function countRealLabels(nodes: LabelTreeNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.label) count += 1
    count += countRealLabels(node.children)
  }
  return count
}

export function GroupLabelsPage({ loadedGroupLabels }: { loadedGroupLabels: GroupLabel[] }) {
  const { labels, saveGroupLabel, removeGroupLabel } = useGroupLabelRows(loadedGroupLabels)
  const [query, setQuery] = useState("")
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [addTagOpen, setAddTagOpen] = useState(false)

  const categoryLabels = useMemo(() => labels.filter((label) => isCategoryLabel(label.label)), [labels])
  const tagLabels = useMemo(() => labels.filter((label) => !isCategoryLabel(label.label)), [labels])

  const categoryTree = useMemo(() => buildCategoryRootTree(categoryLabels), [categoryLabels])
  const filteredCategoryTree = useMemo(() => filterLabelTree(categoryTree, query), [categoryTree, query])
  const filteredTags = useMemo(() => filterFlatLabels(tagLabels, query), [tagLabels, query])

  const isSearching = Boolean(query.trim())
  const matchCount = countRealLabels(filteredCategoryTree) + filteredTags.length

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Web"
        title="Group labels"
        description="Manage the categories and tags used to organize groups on the PoliNetwork website."
        count={matchCount}
        total={labels.length}
        searchPlaceholder="Search categories and tags…"
        onSearch={setQuery}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setAddTagOpen(true)}>
              <Plus data-icon="inline-start" /> Add tag
            </Button>
            <Button onClick={() => setAddCategoryOpen(true)}>
              <Plus data-icon="inline-start" /> Add category
            </Button>
          </div>
        }
      />

      <section className="mb-6">
        <h2 className="mb-1 text-sm font-semibold text-foreground/85">Categories</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          A browsable hierarchy — drill down from Didattica or Extra to organize groups by course, year, or type.
        </p>
        {filteredCategoryTree.length ? (
          <div className="flex flex-col gap-2">
            {filteredCategoryTree.map((node) => (
              <GroupLabelTreeRow
                key={node.path}
                node={node}
                depth={0}
                forceExpanded={isSearching}
                allLabels={loadedGroupLabels}
                onDelete={removeGroupLabel}
                onSave={saveGroupLabel}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FolderTree}
            title="No categories match this search"
            text="Try a different name or description."
          />
        )}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-foreground/85">Tags</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Flat attributes, like a language or campus, that don&apos;t belong to the category hierarchy.
        </p>
        {filteredTags.length ? (
          <div className="flex flex-col gap-2">
            {filteredTags.map((label) => (
              <GroupLabelCard
                key={label.label}
                groupLabel={label}
                allLabels={loadedGroupLabels}
                allowChildren={false}
                onDelete={() => removeGroupLabel(label)}
                onSave={(values) => saveGroupLabel(label, values)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Tags}
            title={tagLabels.length ? "No tags match this search" : "No tags yet"}
            text={
              tagLabels.length
                ? "Try a different name or description."
                : "Add the first tag, like a language or campus."
            }
            action={!tagLabels.length ? <Button onClick={() => setAddTagOpen(true)}>Add first tag</Button> : undefined}
          />
        )}
      </section>

      <AddCategoryDialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen} />
      <AddTagDialog open={addTagOpen} onOpenChange={setAddTagOpen} />
    </div>
  )
}
