import { Link, useRouterState } from "@tanstack/react-router"
import { ChevronRight, MoreVertical, Pencil, Plus } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar"
import {
  buildLabelTree,
  collectSubtreeLabels,
  labelPathToUrlSegments,
  type LabelTreeNode,
} from "@/features/group-labels/label-tree"
import { RenameLabelDialog } from "@/features/group-labels/rename-label-dialog"
import { AddChildLabelDialog } from "@/features/groups-by-label/add-child-label-dialog"
import type { TgGroupLabel } from "@/lib/api/types"
import { cn } from "@/lib/utils"

function labelNodeUrl(path: string): string {
  return `/dashboard/web/groups-by-label/${labelPathToUrlSegments(path).join("/")}`
}

function LabelNavNode({
  node,
  pathname,
  onNavigate,
}: {
  node: LabelTreeNode
  pathname: string
  onNavigate: () => void
}) {
  const hasChildren = node.children.length > 0
  const url = labelNodeUrl(node.path)
  const isActive = pathname === url
  // Starts collapsed, except when the current page is this node or nested under it, so the active trail stays visible.
  const [open, setOpen] = useState(isActive || pathname.startsWith(`${url}/`))
  const [addChildOpen, setAddChildOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)

  return (
    <SidebarMenuSubItem>
      <div className="group/nav-item flex items-center gap-0.5">
        <SidebarMenuSubButton
          isActive={isActive}
          render={<Link to={url} onClick={onNavigate} />}
          className={cn(
            "h-9 flex-1 gap-2.5 rounded-lg pl-2.5 font-mono text-xs text-sidebar-foreground/70",
            "data-active:bg-sidebar-primary/15 data-active:font-medium data-active:text-sidebar-accent-foreground data-active:hover:bg-sidebar-primary/20"
          )}
        >
          <span className="truncate">{node.segment}</span>
        </SidebarMenuSubButton>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-sidebar-foreground/50 opacity-0 hover:bg-sidebar-accent/60 focus-visible:opacity-100 group-hover/nav-item:opacity-100 data-open:opacity-100"
              />
            }
          >
            <MoreVertical />
            <span className="sr-only">More actions for {node.segment}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                <Pencil /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAddChildOpen(true)}>
                <Plus /> Add sub-category
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {hasChildren && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-sidebar-foreground/50 hover:bg-sidebar-accent/60"
            onClick={() => setOpen((current) => !current)}
            aria-label={open ? `Collapse ${node.segment}` : `Expand ${node.segment}`}
          >
            <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
          </Button>
        )}
      </div>
      {hasChildren && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleContent>
            <div className="ml-3 border-l border-sidebar-border pl-2">
              {node.children.map((child) => (
                <LabelNavNode key={child.path} node={child} pathname={pathname} onNavigate={onNavigate} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      <AddChildLabelDialog path={node.path} open={addChildOpen} onOpenChange={setAddChildOpen} />
      <RenameLabelDialog
        path={node.path}
        segment={node.segment}
        affectedLabels={collectSubtreeLabels(node)}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />
    </SidebarMenuSubItem>
  )
}

/** Renders the group-label hierarchy (e.g. informatica.triennale.primo) as nested sidebar links to the matching groups table. */
export function DashboardLabelNav({
  groupLabels,
  onNavigate,
}: {
  groupLabels: TgGroupLabel[]
  onNavigate: () => void
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const tree = buildLabelTree(groupLabels)

  return (
    <>
      {tree.map((node) => (
        <LabelNavNode key={node.path} node={node} pathname={pathname} onNavigate={onNavigate} />
      ))}
    </>
  )
}
