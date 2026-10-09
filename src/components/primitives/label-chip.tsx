import type { ReactElement } from "react"

import { Badge } from "@/components/ui/badge"
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

/** Production pill text that sits at the 4.5:1 edge on the light surface (green-700 on green-500/10 is 4.50). */
const TEXT_CONTRAST_FIXES = new Map([["Green", "text-green-800"]])

type LabelChipProps = {
  label: GroupLabel
  href?: string
  /** Custom link element (e.g. a router `Link`); receives the chip's props. */
  render?: ReactElement
  className?: string
}

/**
 * Categories: outlined chip with a color dot and the last two segments. Tags: pill tinted in the label color,
 * publications without their `release-` prefix.
 */
export function LabelChip({ label, href, render, className }: LabelChipProps) {
  const link = render ?? (href === undefined ? undefined : <a href={href} />)
  const title = labelDisplayName(label.label)

  if (isCategoryLabel(label.label)) {
    return (
      <Chip render={link} title={title} className={cn("max-w-56 min-w-0 shrink", className)}>
        <LabelDot color={label.color} />
        <span className="truncate">{formatLabelCompact(label.label)}</span>
      </Chip>
    )
  }

  const swatch = getGroupLabelColor(label.color)
  return (
    <Badge
      variant="link"
      render={link}
      title={title}
      className={cn(
        "h-[22px] max-w-56 min-w-0 shrink rounded-(--pn-r-full) px-2 text-xs font-medium underline-offset-2 transition-none",
        swatch.badgeClassName,
        TEXT_CONTRAST_FIXES.get(swatch.label),
        className
      )}
      style={swatch.badgeStyle}
    >
      <span className="truncate">{title}</span>
    </Badge>
  )
}
