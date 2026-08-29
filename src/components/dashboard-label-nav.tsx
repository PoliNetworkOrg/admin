import { Link, useRouterState } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar"
import { buildLabelTree, labelPathToUrlSegments, type LabelTreeNode } from "@/features/group-labels/label-tree"
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
  const [open, setOpen] = useState(true)

  return (
    <SidebarMenuSubItem>
      <div className="flex items-center gap-0.5">
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
