import type { ReactElement } from "react"

import { getGroupLabelColor } from "@/features/group-labels/group-labels.constants"
import { formatLabelCompact, isCategoryLabel } from "@/features/group-labels/label-tree"
import type { GroupLabel } from "@/features/group-labels/types"
import { cn } from "@/lib/utils"

import { Chip } from "./chip"
import { labelDisplayName } from "./label-name"

type LabelDotProps = { color: string; className?: string }

/** Label colors are user data, so this (with `LabelChip`) is the one place palette utilities and raw hex are allowed. */
export function LabelDot({ color, className }: LabelDotProps) {
  const swatch = getGroupLabelColor(color)
  return (
    <span
      aria-hidden
      className={cn("size-2 shrink-0 rounded-full", swatch.dotClassName, className)}
      style={swatch.dotStyle}
    />
  )
}

type LabelChipProps = {
  label: GroupLabel
  href?: string
  /** Custom link element (e.g. a router `Link`); receives the chip's props. */
  render?: ReactElement
  className?: string
}

/**
 * A neutral chip with the label's color as a dot, so the text keeps the chip's contrast in both themes. Categories show
 * their last two segments, publications drop the `release-` prefix.
 */
export function LabelChip({ label, href, render, className }: LabelChipProps) {
  const link = render ?? (href === undefined ? undefined : <a href={href} />)
  const title = labelDisplayName(label.label)
  return (
    <Chip
      render={link}
      title={title}
      className={cn(
        "h-6 max-w-56 min-w-0 shrink gap-1.5 rounded-(--pn-r-2) bg-(--pn-muted) px-2.25 font-normal [a]:hover:border-(--pn-fg-subtle) [a]:hover:bg-(--pn-muted)",
        className
      )}
    >
      <LabelDot color={label.color} />
      <span className="truncate">{isCategoryLabel(label.label) ? formatLabelCompact(label.label) : title}</span>
    </Chip>
  )
}
