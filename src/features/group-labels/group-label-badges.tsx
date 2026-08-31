import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"

import { getGroupLabelColor } from "./group-labels.constants"
import { LabelDot } from "./label-dot"
import { formatLabelCompact, formatLabelSegment, isCategoryLabel, labelPathToUrlSegments } from "./label-tree"
import type { GroupLabel } from "./types"

/**
 * Renders a group's labels split by kind, instead of one undifferentiated row of identical badges: its flat
 * tags as solid color-coded pills (their color is what makes them scannable, e.g. a language or campus at a
 * glance), and its category as a lighter, clickable outline chip that jumps straight to that category's group
 * list — the color belongs to the tag, not to a position in the hierarchy.
 */
export function GroupLabelBadges({ labels }: { labels: GroupLabel[] }) {
  if (!labels.length) return <span className="text-xs italic text-muted-foreground">No labels</span>

  const categories = labels.filter((label) => isCategoryLabel(label.label))
  const tags = labels.filter((label) => !isCategoryLabel(label.label))

  return (
    <div className="flex flex-wrap items-center gap-1" onClick={(event) => event.stopPropagation()}>
      {categories.map((label) => {
        const url: string = `/dashboard/web/groups-by-label/${labelPathToUrlSegments(label.label).join("/")}`
        return (
          <Link
            key={label.label}
            to={url}
            title={label.label}
            className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            <LabelDot color={label.color} />
            {formatLabelCompact(label.label)}
          </Link>
        )
      })}
      {tags.map((label) => {
        const swatch = getGroupLabelColor(label.color)
        return (
          <span
            key={label.label}
            title={label.label}
            className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium", swatch.badgeClassName)}
            style={swatch.badgeStyle}
          >
            {formatLabelSegment(label.label)}
          </span>
        )
      })}
    </div>
  )
}
