import { FolderTree, Megaphone, Plus, Tags } from "lucide-react"
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
  hasReleaseLabelPrefix,
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
  const [addPublicationOpen, setAddPublicationOpen] = useState(false)

  const categoryLabels = useMemo(() => labels.filter((label) => isCategoryLabel(label.label)), [labels])
  const tagLabels = useMemo(
    () => labels.filter((label) => !isCategoryLabel(label.label) && !hasReleaseLabelPrefix(label.label)),
    [labels]
  )
  const releaseLabels = useMemo(() => labels.filter((label) => hasReleaseLabelPrefix(label.label)), [labels])
  const filteredReleases = useMemo(() => filterFlatLabels(releaseLabels, query), [releaseLabels, query])

  const categoryTree = useMemo(() => buildCategoryRootTree(categoryLabels), [categoryLabels])
  const filteredCategoryTree = useMemo(() => filterLabelTree(categoryTree, query), [categoryTree, query])
  const filteredTags = useMemo(() => filterFlatLabels(tagLabels, query), [tagLabels, query])

  const isSearching = Boolean(query.trim())
  const matchCount = countRealLabels(filteredCategoryTree) + filteredTags.length + filteredReleases.length

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Web"
        title="Group labels"
        description="Manage permanent categories and attributes separately from publication batches."
        count={matchCount}
        total={labels.length}
        searchPlaceholder="Search categories, attributes and publications…"
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
                allLabels={labels}
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

      <section className="mb-6">
        <h2 className="mb-1 text-sm font-semibold text-foreground/85">Attributes</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Permanent tags, like a language or campus. They are preserved when groups are published.
        </p>
        {filteredTags.length ? (
          <div className="flex flex-col gap-2">
            {filteredTags.map((label) => (
              <GroupLabelCard
                key={label.label}
                groupLabel={label}
                allLabels={labels}
                allowChildren={false}
                linkTo={`/dashboard/web/tags/${encodeURIComponent(label.label)}`}
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

      <section aria-label="Publications">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="mb-1 text-sm font-semibold text-foreground/85">Publications</h2>
            <p className="text-xs text-muted-foreground">
              Temporary batches of groups to publish together. Only their release labels are cleared.
            </p>
          </div>
          <Button variant="outline" onClick={() => setAddPublicationOpen(true)}>
            <Megaphone data-icon="inline-start" /> Create publication
          </Button>
        </div>
        {filteredReleases.length ? (
          <div className="flex flex-col gap-2">
            {filteredReleases.map((label) => (
              <GroupLabelCard
                key={label.label}
                groupLabel={label}
                allLabels={labels}
                allowChildren={false}
                allowRename={false}
                linkTo={`/dashboard/web/tags/${encodeURIComponent(label.label)}`}
                onDelete={() => removeGroupLabel(label)}
                onSave={(values) => saveGroupLabel(label, values)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Megaphone}
            title={releaseLabels.length ? "No publications match this search" : "No publications yet"}
            text={
              releaseLabels.length
                ? "Try a different name or description."
                : "Create a publication, add existing groups, then publish the batch."
            }
          />
        )}
      </section>

      <AddTagDialog open={addPublicationOpen} onOpenChange={setAddPublicationOpen} publication />
      <AddCategoryDialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen} />
      <AddTagDialog open={addTagOpen} onOpenChange={setAddTagOpen} />
    </div>
  )
}
