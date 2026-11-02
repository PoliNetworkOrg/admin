import { StatusBadge } from "@/components/primitives"

import { KIND_LABELS, STATE_LABELS, STATE_TONES } from "./regulations-format"
import type { DraftKind, StateKey } from "./regulations.contract"

/** A draft's state, in the procedure's words when given. */
export function DraftStateBadge({ state, label }: { state: StateKey; label?: string }) {
  return <StatusBadge tone={STATE_TONES[state]}>{label ?? STATE_LABELS[state]}</StatusBadge>
}

/** "Rettifica" next to a title; ordinary drafts (modifiche) show nothing. */
export function DraftKindMark({ kind }: { kind: DraftKind }) {
  if (kind === "modifica") return null
  return (
    <span className="inline-flex h-[22px] items-center rounded-(--pn-r-full) border border-(--pn-line) px-2 text-xs font-medium text-(--pn-fg-muted)">
      {KIND_LABELS[kind]}
    </span>
  )
}
