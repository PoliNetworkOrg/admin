import { ChevronRight, FolderPlus, MoreVertical, PencilLine } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AddChildLabelDialog } from "@/features/groups-by-label/add-child-label-dialog"
import { cn } from "@/lib/utils"

import { GroupLabelCard } from "./group-label-card"
import { formatLabelBreadcrumb, formatLabelSegment, isReservedCategoryRoot, type LabelTreeNode } from "./label-tree"
import { RenameLabelDialog } from "./rename-label-dialog"
import type { GroupLabel, GroupLabelEditValues } from "./types"

/** Recursively renders a category-hierarchy node: a full editable row when it's a real label, or a plain
 * grouping row (rename/add-child only) when it's just an implied ancestor with no label of its own. */
export function GroupLabelTreeRow({
  node,
  depth,
  forceExpanded,
  allLabels,
  onDelete,
  onSave,
}: {
  node: LabelTreeNode
  depth: number
  forceExpanded: boolean
  allLabels: GroupLabel[]
  onDelete: (label: GroupLabel) => Promise<boolean>
  onSave: (label: GroupLabel, values: GroupLabelEditValues) => Promise<boolean>
}) {
  const label = node.label
  const hasChildren = node.children.length > 0
  const isRoot = depth === 0
  // The two fixed category roots (Didattica, Extra) can't be renamed — the whole tree keys off their exact name.
  const allowRename = !(isRoot && isReservedCategoryRoot(node.path))
  const [manualExpanded, setManualExpanded] = useState(false)
  const expanded = forceExpanded || manualExpanded
  const [renameOpen, setRenameOpen] = useState(false)
  const [addChildOpen, setAddChildOpen] = useState(false)

  const chevron = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("shrink-0", !hasChildren && "invisible")}
      onClick={() => setManualExpanded((current) => !current)}
      aria-label={
        expanded ? `Collapse ${formatLabelSegment(node.segment)}` : `Expand ${formatLabelSegment(node.segment)}`
      }
    >
      <ChevronRight className={cn("transition-transform", expanded && "rotate-90")} />
    </Button>
  )

  return (
    <div className={cn(depth > 0 && "ml-4 border-l border-border/60 pl-3")}>
      {label ? (
        <GroupLabelCard
          groupLabel={label}
          allLabels={allLabels}
          leading={chevron}
          allowRename={allowRename}
          onDelete={() => onDelete(label)}
          onSave={(values) => onSave(label, values)}
        />
      ) : (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border py-2 pr-2 pl-1",
            isRoot ? "border-border/60 bg-muted/30" : "border-dashed border-border/60"
          )}
        >
          {chevron}
          <span className={cn("text-sm", isRoot ? "font-semibold" : "text-muted-foreground")}>
            {formatLabelSegment(node.segment)}
          </span>
          {!isRoot && (
            <span className="text-xs text-muted-foreground/70 italic">No details set for this level yet</span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" className="ml-auto" />}>
              <MoreVertical />
              <span className="sr-only">More actions for {formatLabelBreadcrumb(node.path)}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                {allowRename && (
                  <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                    <PencilLine /> Rename
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setAddChildOpen(true)}>
                  <FolderPlus /> Add sub-category
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {allowRename && (
            <RenameLabelDialog
              path={node.path}
              segment={node.segment}
              affectedLabels={allLabels.filter(
                (label) => label.label === node.path || label.label.startsWith(`${node.path}.`)
              )}
              open={renameOpen}
              onOpenChange={setRenameOpen}
            />
          )}
          <AddChildLabelDialog
            path={node.path}
            open={addChildOpen}
            onOpenChange={setAddChildOpen}
            navigateOnSuccess={false}
          />
        </div>
      )}
      {hasChildren && expanded && (
        <div className="mt-2 flex flex-col gap-2">
          {node.children.map((child) => (
            <GroupLabelTreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              forceExpanded={forceExpanded}
              allLabels={allLabels}
              onDelete={onDelete}
              onSave={onSave}
            />
          ))}
        </div>
      )}
    </div>
  )
}
