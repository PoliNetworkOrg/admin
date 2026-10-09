import { Check, ChevronRight, Minus, Search, X } from "lucide-react"
import { useMemo, useState } from "react"

import {
  buildLabelTree,
  collectSubtreeLabels,
  filterFlatLabels,
  formatLabelBreadcrumb,
  formatLabelCompact,
  formatLabelSegment,
  hasReleaseLabelPrefix,
  isCategoryLabel,
  type LabelTreeNode,
} from "@/features/group-labels/label-tree"
import type { GroupLabel } from "@/features/group-labels/types"
import { cn, cssVariables } from "@/lib/utils"

import { LabelDot } from "./label-chip"
import { labelDisplayName } from "./label-name"
import { Reveal } from "./reveal"
import { SectionEmpty } from "./section-empty"

type ToggleMany = (labels: GroupLabel[], select: boolean) => void

/** Selected-chip text: a category's last two segments, otherwise the attribute or publication name. */
function labelChipText(path: string) {
  return isCategoryLabel(path) ? formatLabelCompact(path) : labelDisplayName(path)
}

const rowClasses =
  "flex h-8 min-w-0 flex-1 items-center gap-2 rounded-(--pn-r-2) px-2 text-left text-[13px] text-(--pn-fg) transition-[background-color] duration-120 hover:bg-(--pn-muted) aria-pressed:bg-(--pn-accent-soft) aria-pressed:hover:bg-(--pn-accent-soft-hover) aria-[pressed=mixed]:bg-(--pn-accent-soft)"

function SectionTitle({ children }: { children: string }) {
  return <p className="px-2 pt-2 pb-1 text-xs font-medium text-(--pn-fg-muted)">{children}</p>
}

type TreeNodeProps = {
  node: LabelTreeNode
  depth: number
  isSelected: (label: GroupLabel) => boolean
  onToggleMany: ToggleMany
}

function TreeNode({ node, depth, isSelected, onToggleMany }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const name = formatLabelSegment(node.segment)
  const subtree = useMemo(() => collectSubtreeLabels(node), [node])
  const selectedCount = subtree.filter(isSelected).length
  const all = subtree.length > 0 && selectedCount === subtree.length
  const some = selectedCount > 0 && !all
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div className="flex items-center gap-0.5" style={{ paddingLeft: depth * 24 }}>
        <button
          type="button"
          aria-label={`${expanded ? "Collapse" : "Expand"} ${name}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-(--pn-r-2) text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:bg-(--pn-muted) hover:text-(--pn-fg)",
            !hasChildren && "invisible"
          )}
        >
          <ChevronRight
            aria-hidden
            className={cn("size-4 transition-transform duration-150 ease-(--pn-ease-out)", expanded && "rotate-90")}
          />
        </button>
        <button
          type="button"
          aria-pressed={all ? true : some ? "mixed" : false}
          disabled={!subtree.length}
          onClick={() => onToggleMany(subtree, !all)}
          className={rowClasses}
        >
          {node.label ? <LabelDot color={node.label.color} /> : <span aria-hidden className="size-2 shrink-0" />}
          <span className={cn("truncate", !node.label && "text-(--pn-fg-muted)")}>{name}</span>
          {all && <Check aria-hidden className="ml-auto size-4 shrink-0 text-(--pn-accent)" />}
          {some && <Minus aria-hidden className="ml-auto size-4 shrink-0 text-(--pn-accent)" />}
        </button>
      </div>
      {hasChildren && (
        <Reveal open={expanded}>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              isSelected={isSelected}
              onToggleMany={onToggleMany}
            />
          ))}
        </Reveal>
      )}
    </div>
  )
}

function FlatCategory({
  label,
  selected,
  onToggleMany,
}: {
  label: GroupLabel
  selected: boolean
  onToggleMany: ToggleMany
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggleMany([label], !selected)}
      className={cn(rowClasses, "w-full")}
    >
      <LabelDot color={label.color} />
      <span className="truncate">{formatLabelBreadcrumb(label.label)}</span>
      {selected && <Check aria-hidden className="ml-auto size-4 shrink-0 text-(--pn-accent)" />}
    </button>
  )
}

function TagToggle({
  label,
  selected,
  onToggleMany,
}: {
  label: GroupLabel
  selected: boolean
  onToggleMany: ToggleMany
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggleMany([label], !selected)}
      style={cssVariables({ "--label-color": label.color })}
      className="inline-flex h-7 items-center gap-1.5 rounded-(--pn-r-full) border border-(--pn-line) px-2.5 text-xs font-medium text-(--pn-fg) transition-[background-color,border-color] duration-120 hover:bg-(--pn-muted) aria-pressed:border-[color-mix(in_oklch,var(--label-color)_45%,transparent)] aria-pressed:bg-[color-mix(in_oklch,var(--label-color)_15%,transparent)]"
    >
      <LabelDot color={label.color} />
      {labelDisplayName(label.label)}
    </button>
  )
}

type LabelTreeSelectorProps = {
  allLabels: GroupLabel[]
  /** Selected label paths. */
  selected: string[]
  onToggleMany: ToggleMany
  /** Only attributes and publications, no category tree. */
  tagsOnly?: boolean
  className?: string
}

/** 320px picker: search, removable selected chips, category tree with subtree toggles, attribute/publication chips. */
export function LabelTreeSelector({
  allLabels,
  selected,
  onToggleMany,
  tagsOnly = false,
  className,
}: LabelTreeSelectorProps) {
  const [query, setQuery] = useState("")
  const searching = query.trim().length > 0
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const isSelected = (label: GroupLabel) => selectedSet.has(label.label)

  const categories = useMemo(() => allLabels.filter((label) => isCategoryLabel(label.label)), [allLabels])
  const attributes = useMemo(
    () => allLabels.filter((label) => !isCategoryLabel(label.label) && !hasReleaseLabelPrefix(label.label)),
    [allLabels]
  )
  const publications = useMemo(() => allLabels.filter((label) => hasReleaseLabelPrefix(label.label)), [allLabels])
  const tree = useMemo(() => buildLabelTree(categories), [categories])

  const matchingCategories = tagsOnly ? [] : filterFlatLabels(categories, query)
  const visibleAttributes = filterFlatLabels(attributes, query)
  const visiblePublications = filterFlatLabels(publications, query)
  const selectedLabels = allLabels.filter(isSelected)
  const showTree = !tagsOnly && !searching && tree.length > 0
  const nothing = !showTree && !matchingCategories.length && !visibleAttributes.length && !visiblePublications.length

  return (
    <div
      className={cn(
        "flex h-80 flex-col overflow-hidden rounded-(--pn-r-3) border border-(--pn-line) bg-(--pn-surface) transition-[border-color] duration-120 has-[input:focus-visible]:border-(--pn-focus)",
        className
      )}
    >
      <label className="flex h-9 shrink-0 items-center gap-2 border-b border-(--pn-line) px-3">
        <Search aria-hidden className="size-4 shrink-0 text-(--pn-fg-muted)" />
        <span className="sr-only">Search labels</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tagsOnly ? "Search attributes and publications…" : "Search labels…"}
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-(--pn-fg) outline-none placeholder:text-(--pn-fg-subtle) focus-visible:shadow-none! pointer-coarse:text-base"
        />
      </label>

      {selectedLabels.length > 0 && (
        // Own block under the search: two 24px lines (plus the 4px gap) then it scrolls; 8px below the chips.
        <div className="shrink-0 border-b border-(--pn-line) px-2 pt-2 pb-2">
          <div className="flex max-h-[52px] flex-wrap content-start gap-1 overflow-y-auto">
            {selectedLabels.map((label) => (
              <button
                key={label.label}
                type="button"
                aria-label={`Remove ${labelDisplayName(label.label)}`}
                title={labelDisplayName(label.label)}
                onClick={() => onToggleMany([label], false)}
                className="inline-flex h-6 items-center gap-1.5 rounded-(--pn-r-full) bg-(--pn-muted) pr-1.5 pl-2 text-xs font-medium text-(--pn-fg) transition-[background-color] duration-120 hover:bg-(--pn-nav-active)"
              >
                <LabelDot color={label.color} />
                {labelChipText(label.label)}
                <X aria-hidden className="size-3 text-(--pn-fg-muted)" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {showTree && (
          <section>
            <SectionTitle>Categories</SectionTitle>
            {tree.map((node) => (
              <TreeNode key={node.path} node={node} depth={0} isSelected={isSelected} onToggleMany={onToggleMany} />
            ))}
          </section>
        )}
        {matchingCategories.length > 0 && searching && (
          <section>
            <SectionTitle>Categories</SectionTitle>
            {matchingCategories.map((label) => (
              <FlatCategory key={label.label} label={label} selected={isSelected(label)} onToggleMany={onToggleMany} />
            ))}
          </section>
        )}
        {[
          { title: "Attributes", labels: visibleAttributes },
          { title: "Publications", labels: visiblePublications },
        ].map(
          (section) =>
            section.labels.length > 0 && (
              <section key={section.title}>
                <SectionTitle>{section.title}</SectionTitle>
                <div className="flex flex-wrap gap-1.5 px-2 pb-2">
                  {section.labels.map((label) => (
                    <TagToggle
                      key={label.label}
                      label={label}
                      selected={isSelected(label)}
                      onToggleMany={onToggleMany}
                    />
                  ))}
                </div>
              </section>
            )
        )}
        {nothing && (
          <SectionEmpty
            title={searching ? "No labels match" : "No labels have been created yet"}
            className="px-2 py-6"
          />
        )}
      </div>
    </div>
  )
}
