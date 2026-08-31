import { Check, ChevronRight, Minus, X } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { getGroupLabelColor } from "./group-labels.constants"
import { LabelDot } from "./label-dot"
import {
  buildLabelTree,
  collectSubtreeLabels,
  filterFlatLabels,
  formatLabelBreadcrumb,
  formatLabelChip,
  formatLabelSegment,
  isCategoryLabel,
  type LabelTreeNode,
} from "./label-tree"
import type { GroupLabel } from "./types"

function LabelTreeSelectorNode({
  node,
  isSelected,
  onToggleMany,
  depth,
}: {
  node: LabelTreeNode
  isSelected: (label: GroupLabel) => boolean
  onToggleMany: (labels: GroupLabel[], select: boolean) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = node.children.length > 0
  const subtreeLabels = useMemo(() => collectSubtreeLabels(node), [node])
  const selectedCount = subtreeLabels.filter((label) => isSelected(label)).length
  const allSelected = subtreeLabels.length > 0 && selectedCount === subtreeLabels.length
  const someSelected = selectedCount > 0 && !allSelected

  return (
    <div className={cn(depth > 0 && "ml-4 border-l border-border/60 pl-2")}>
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={cn(!hasChildren && "invisible")}
          onClick={() => setExpanded((current) => !current)}
          aria-label={expanded ? `Collapse ${node.segment}` : `Expand ${node.segment}`}
        >
          <ChevronRight className={cn("transition-transform", expanded && "rotate-90")} />
        </Button>
        <button
          type="button"
          aria-pressed={allSelected}
          onClick={() => onToggleMany(subtreeLabels, !allSelected)}
          title={hasChildren ? `Select the whole "${node.path}" branch` : undefined}
          className={cn(
            "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
            (allSelected || someSelected) && "bg-primary/10 font-medium text-primary"
          )}
        >
          {node.label ? <LabelDot color={node.label.color} /> : <span className="size-2 shrink-0" />}
          <span className={cn("truncate", !node.label && "text-muted-foreground")}>
            {formatLabelSegment(node.segment)}
          </span>
          {allSelected ? (
            <Check className="ml-auto size-4 shrink-0" />
          ) : (
            someSelected && <Minus className="ml-auto size-4 shrink-0" />
          )}
        </button>
      </div>
      {expanded &&
        node.children.map((child) => (
          <LabelTreeSelectorNode
            key={child.path}
            node={child}
            isSelected={isSelected}
            onToggleMany={onToggleMany}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}

/** A single matching category, found by search — its full breadcrumb stands in for tree position, so picking it
 * is a straight click instead of expanding down to it level by level. */
function CategorySearchResult({
  label,
  isSelected,
  onToggleMany,
}: {
  label: GroupLabel
  isSelected: (label: GroupLabel) => boolean
  onToggleMany: (labels: GroupLabel[], select: boolean) => void
}) {
  const checked = isSelected(label)
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onToggleMany([label], !checked)}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
        checked && "bg-primary/10 font-medium text-primary"
      )}
    >
      <LabelDot color={label.color} />
      <span className="truncate">{formatLabelBreadcrumb(label.label)}</span>
      {checked && <Check className="ml-auto size-4 shrink-0" />}
    </button>
  )
}

/** Lets an admin pick labels for a group: a browsable category tree, plus flat tag chips — no dotted paths shown. */
export function LabelTreeSelector({
  allLabels,
  selected,
  onToggleMany,
}: {
  allLabels: GroupLabel[]
  selected: GroupLabel[]
  onToggleMany: (labels: GroupLabel[], select: boolean) => void
}) {
  const [query, setQuery] = useState("")
  const categoryLabels = useMemo(() => allLabels.filter((label) => isCategoryLabel(label.label)), [allLabels])
  const tagLabels = useMemo(() => allLabels.filter((label) => !isCategoryLabel(label.label)), [allLabels])
  const tree = useMemo(() => buildLabelTree(categoryLabels), [categoryLabels])
  const isSearching = Boolean(query.trim())
  // Searching a hierarchy by expanding one branch at a time is slow, unlike picking a tag — so a search instead
  // flattens straight to matching categories (with their breadcrumb for context), skipping the tree entirely.
  const matchingCategories = useMemo(() => filterFlatLabels(categoryLabels, query), [categoryLabels, query])
  const visibleTags = useMemo(
    () => (isSearching ? filterFlatLabels(tagLabels, query) : tagLabels),
    [tagLabels, query, isSearching]
  )
  const isSelected = (label: GroupLabel) => selected.some((current) => current.label === label.label)

  return (
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Search labels…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-9"
      />
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((label) => {
            const swatch = getGroupLabelColor(label.color)
            return (
              <button
                key={label.label}
                type="button"
                onClick={() => onToggleMany([label], false)}
                title={label.label}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                  swatch.badgeClassName
                )}
                style={swatch.badgeStyle}
              >
                {formatLabelChip(label.label)}
                <X className="size-3" />
              </button>
            )
          })}
        </div>
      )}
      <div className="max-h-64 overflow-y-auto rounded-md border border-border p-1">
        {isSearching
          ? matchingCategories.length > 0 && (
              <div className="mb-1">
                <p className="px-2 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Categories
                </p>
                {matchingCategories.map((label) => (
                  <CategorySearchResult
                    key={label.label}
                    label={label}
                    isSelected={isSelected}
                    onToggleMany={onToggleMany}
                  />
                ))}
              </div>
            )
          : tree.length > 0 && (
              <div className="mb-1">
                <p className="px-2 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Categories
                </p>
                {tree.map((node) => (
                  <LabelTreeSelectorNode
                    key={node.path}
                    node={node}
                    isSelected={isSelected}
                    onToggleMany={onToggleMany}
                    depth={0}
                  />
                ))}
              </div>
            )}
        {visibleTags.length > 0 && (
          <div>
            <p className="px-2 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Tags</p>
            <div className="flex flex-wrap gap-1 px-2 pb-1">
              {visibleTags.map((label) => {
                const checked = isSelected(label)
                const swatch = getGroupLabelColor(label.color)
                return (
                  <button
                    key={label.label}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => onToggleMany([label], !checked)}
                    className={cn(
                      "flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
                      checked ? swatch.badgeClassName : "border-border bg-transparent text-muted-foreground"
                    )}
                    style={checked ? swatch.badgeStyle : undefined}
                  >
                    <LabelDot color={label.color} />
                    {formatLabelSegment(label.label)}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {(isSearching ? !matchingCategories.length : !tree.length) && !visibleTags.length && (
          <p className="p-2 text-sm text-muted-foreground">No matching labels</p>
        )}
      </div>
    </div>
  )
}
