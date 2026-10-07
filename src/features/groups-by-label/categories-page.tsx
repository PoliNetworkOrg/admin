import { Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { useMemo, useState } from "react"

import { buttonMotion, NavCard } from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCanWrite } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { AddCategoryDialog } from "@/features/group-labels/add-category-dialog"
import {
  buildCategoryRootTree,
  countCategoryDescendants,
  formatLabelSegment,
  isCategoryLabel,
} from "@/features/group-labels/label-tree"
import type { GroupLabel } from "@/features/group-labels/types"

/** The top of the category tree: one card per fixed root (Didattica, Extra), even before it has categories. */
export function CategoriesPage({ labels }: { labels: GroupLabel[] }) {
  const canWrite = useCanWrite("web")
  const [addOpen, setAddOpen] = useState(false)
  const roots = useMemo(() => buildCategoryRootTree(labels.filter((label) => isCategoryLabel(label.label))), [labels])
  const total = roots.reduce((sum, root) => sum + countCategoryDescendants(root), 0)

  return (
    <>
      <PageBar
        left={<Toolbar count={<Count value={total} noun="category" />} />}
        right={
          canWrite && (
            <Button size="sm" onClick={() => setAddOpen(true)} className={buttonMotion}>
              <Plus aria-hidden data-icon="inline-start" />
              Add category
            </Button>
          )
        }
      />
      <PageContent width="wide">
        <nav aria-label="Top-level categories" className="grid gap-3 md:grid-cols-2">
          {roots.map((root) => (
            <NavCard
              key={root.path}
              title={formatLabelSegment(root.segment)}
              count={countCategoryDescendants(root)}
              noun="category"
              render={<Link to="/dashboard/web/groups-by-label/$" params={{ _splat: root.path }} />}
            />
          ))}
        </nav>
      </PageContent>
      <AddCategoryDialog open={addOpen} onOpenChange={setAddOpen} labels={labels} />
    </>
  )
}
