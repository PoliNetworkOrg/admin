import { Link } from "@tanstack/react-router"
import { ArrowRight, Plus } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"

import { buttonMotion, LabelDot } from "@/components/primitives"
import { PageBar, PageContent, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { AddCategoryDialog } from "@/features/group-labels/add-category-dialog"
import {
  buildCategoryRootTree,
  countBranchGroups,
  countCategoryDescendants,
  formatLabelSegment,
  isCategoryLabel,
  labelPathToUrlSegments,
  type LabelTreeNode,
} from "@/features/group-labels/label-tree"
import type { GroupLabel } from "@/features/group-labels/types"
import type { GroupWithLabels } from "@/lib/api/types"
import { formatNumber, pluralize } from "@/lib/format"

/** Sub-category chips shown per root; the rest collapse into "+ n more", which opens the root. */
const VISIBLE_CHILDREN = 5

/**
 * The top of the category tree: one card per fixed root (Didattica, Extra), even before it has categories. The whole
 * card opens the root; its first sub-categories are chips with their group counts.
 */
export function CategoriesPage({ labels, groups }: { labels: GroupLabel[]; groups: GroupWithLabels[] }) {
  const canWrite = useCan("groups:labels:write")
  const [addOpen, setAddOpen] = useState(false)
  const roots = useMemo(() => buildCategoryRootTree(labels.filter((label) => isCategoryLabel(label.label))), [labels])
  const groupLabels = useMemo(() => groups.map((group) => group.labels), [groups])
  const total = roots.reduce((sum, root) => sum + countCategoryDescendants(root), 0)

  return (
    <>
      <PageBar
        description={`${pluralize(total, "category")} in ${pluralize(roots.length, "top-level tree")} — open one to manage its groups`}
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
        <nav aria-label="Top-level categories" className="grid gap-4 min-[900px]:grid-cols-2">
          {roots.map((root) => (
            <RootCard key={root.path} root={root} groupLabels={groupLabels} />
          ))}
        </nav>
      </PageContent>
      <AddCategoryDialog open={addOpen} onOpenChange={setAddOpen} labels={labels} />
    </>
  )
}

function RootCard({ root, groupLabels }: { root: LabelTreeNode; groupLabels: string[][] }) {
  const hidden = root.children.length - VISIBLE_CHILDREN
  return (
    <article className="group/root relative flex flex-col gap-4.5 rounded-[14px] border border-(--pn-line) bg-(--pn-surface) p-5.5 transition-[background-color,border-color] duration-120 hover:border-(--pn-hover-line) hover:bg-(--pn-hover) max-shell:p-4">
      <div className="flex items-center gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-[11px] border border-(--pn-line) bg-(--pn-muted)">
          {root.label ? (
            <LabelDot color={root.label.color} className="size-3" />
          ) : (
            <span className="size-3 rounded-full bg-(--pn-fg-subtle)" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-[20px] leading-7 font-semibold text-(--pn-fg)">
            {/* The card's link: its ::after covers the card; the chips sit above it. */}
            <Link
              to="/dashboard/web/groups-by-label/$"
              params={{ _splat: root.path }}
              className="after:absolute after:inset-0 after:rounded-[14px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-(--pn-focus)"
            >
              {formatLabelSegment(root.segment)}
            </Link>
          </h2>
          <span className="text-[13px] text-(--pn-fg-muted) tabular-nums">
            {pluralize(countCategoryDescendants(root), "category")},{" "}
            {pluralize(countBranchGroups(groupLabels, root.path), "group")}
          </span>
        </div>
        <ArrowRight
          aria-hidden
          className="size-5 shrink-0 text-(--pn-fg-subtle) transition-[transform,color] duration-120 group-hover/root:translate-x-0.5 group-hover/root:text-(--pn-fg)"
        />
      </div>
      {root.children.length > 0 ? (
        <ul aria-label={`${formatLabelSegment(root.segment)} sub-categories`} className="flex flex-wrap gap-2">
          {root.children.slice(0, VISIBLE_CHILDREN).map((child) => (
            <li key={child.path}>
              <SubChip path={child.path}>
                {formatLabelSegment(child.segment)}
                <span className="font-mono text-[11px] font-normal text-(--pn-fg-muted) tabular-nums">
                  {formatNumber(countBranchGroups(groupLabels, child.path))}
                  <span className="sr-only"> groups</span>
                </span>
              </SubChip>
            </li>
          ))}
          {hidden > 0 ? (
            <li>
              <SubChip path={root.path}>+ {formatNumber(hidden)} more</SubChip>
            </li>
          ) : null}
        </ul>
      ) : null}
    </article>
  )
}

/** A sub-category button; it sits above the card's covering link. */
function SubChip({ path, children }: { path: string; children: ReactNode }) {
  return (
    <Link
      to="/dashboard/web/groups-by-label/$"
      params={{ _splat: labelPathToUrlSegments(path).join("/") }}
      className="relative z-[1] inline-flex h-9 items-center gap-2 rounded-(--pn-r-3) border border-(--pn-line) bg-(--pn-muted) px-3 text-[13px] font-medium text-(--pn-fg) transition-[background-color,border-color] duration-120 hover:border-(--pn-hover-line) hover:bg-(--pn-hover)"
    >
      {children}
    </Link>
  )
}
