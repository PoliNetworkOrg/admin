import { ArrowDown, ArrowUp, Pencil } from "lucide-react"

import { IconButton } from "@/components/primitives"

import { FRESHMAN_ICONS } from "./freshman-icon"
import type { FreshmanCard } from "./types"

type FreshmanCardRowProps = {
  card: FreshmanCard
  canWrite: boolean
  pending: boolean
  first: boolean
  last: boolean
  onMove: (direction: -1 | 1) => void
  onEdit: () => void
}

export function FreshmanCardRow({ card, canWrite, pending, first, last, onMove, onEdit }: FreshmanCardRowProps) {
  const Icon = FRESHMAN_ICONS[card.icon]
  return (
    <div className="flex items-start gap-3 border-b border-(--pn-line) p-4 last:border-0">
      <Icon aria-hidden className="mt-1 size-5 shrink-0 text-(--pn-fg-muted)" />
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium break-words text-(--pn-fg)">{card.title}</h3>
        {card.description && <p className="mt-1 text-[13px] text-(--pn-fg-muted)">{card.description}</p>}
        <p className="mt-1 break-all text-xs text-(--pn-fg-muted)">{card.href || "No destination set"}</p>
      </div>
      {canWrite && (
        <div className="flex shrink-0 flex-wrap justify-end gap-0.5 max-shell:max-w-18">
          <IconButton
            label="Move up"
            ariaLabel={`Move ${card.title} up`}
            icon={ArrowUp}
            disabled={pending || first}
            onClick={() => onMove(-1)}
          />
          <IconButton
            label="Move down"
            ariaLabel={`Move ${card.title} down`}
            icon={ArrowDown}
            disabled={pending || last}
            onClick={() => onMove(1)}
          />
          <IconButton label="Edit" ariaLabel={`Edit ${card.title}`} icon={Pencil} disabled={pending} onClick={onEdit} />
        </div>
      )}
    </div>
  )
}
