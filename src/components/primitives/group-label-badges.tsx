import type { ReactElement } from "react"

import { isCategoryLabel } from "@/features/group-labels/label-tree"
import type { GroupLabel } from "@/features/group-labels/types"

import { ChipOverflow } from "./chip-overflow"
import { LabelChip } from "./label-chip"
import { labelDisplayName } from "./label-name"
import { Unset } from "./unset"

type GroupLabelBadgesProps = {
  labels: GroupLabel[]
  /** Chips shown before the rest collapse into a "+n" badge. Defaults to 2, what fits a 44px row. */
  max?: number
  hrefForLabel?: (label: string) => string
  /** Builds the link element for a label, e.g. `(label) => <Link to=… />`. Wins over `hrefForLabel`. */
  renderLink?: (label: string) => ReactElement
  className?: string
}

/**
 * A group's labels: categories first, then tags; `—` when it has none. Past `max` chips a "+n" badge lists
 * the remaining labels in its tooltip. Clicks never reach the row.
 */
export function GroupLabelBadges({ labels, max = 2, hrefForLabel, renderLink, className }: GroupLabelBadgesProps) {
  if (!labels.length) return <Unset />

  const ordered = [
    ...labels.filter((label) => isCategoryLabel(label.label)),
    ...labels.filter((label) => !isCategoryLabel(label.label)),
  ]
  return (
    <ChipOverflow
      items={ordered}
      max={max}
      itemLabel={(label) => labelDisplayName(label.label)}
      renderItem={(label) => (
        <LabelChip
          key={label.label}
          label={label}
          href={hrefForLabel?.(label.label)}
          render={renderLink?.(label.label)}
        />
      )}
      className={className}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    />
  )
}
