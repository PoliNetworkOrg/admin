import { Check, ChevronRight, Minus, X } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { getGroupLabelColor } from "./group-labels.constants"
import { LabelDot } from "./label-dot"
import { buildLabelTree, collectSubtreeLabels, filterLabelTree, type LabelTreeNode } from "./label-tree"
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
          <span className={cn("truncate", !node.label && "font-mono text-muted-foreground")}>{node.segment}</span>
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

/** Lets an admin pick labels by walking their dot-separated hierarchy, with search, instead of a single flat list. */
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
  const tree = useMemo(() => buildLabelTree(allLabels), [allLabels])
  const filteredTree = useMemo(() => filterLabelTree(tree, query), [tree, query])
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
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                  swatch.badgeClassName
                )}
                style={swatch.badgeStyle}
              >
                {label.label}
                <X className="size-3" />
              </button>
            )
          })}
        </div>
      )}
      <div className="max-h-64 overflow-y-auto rounded-md border border-border p-1">
        {filteredTree.length ? (
          filteredTree.map((node) => (
            <LabelTreeSelectorNode
              key={node.path}
              node={node}
              isSelected={isSelected}
              onToggleMany={onToggleMany}
              depth={0}
            />
          ))
        ) : (
          <p className="p-2 text-sm text-muted-foreground">No matching labels</p>
        )}
      </div>
    </div>
  )
}
