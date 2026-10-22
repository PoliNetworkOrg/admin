import { Chip } from "@/components/primitives/chip"
import { StatusBadge } from "@/components/primitives/status-badge"
import type { EsignRequest, EsignSigner } from "@/lib/api/types"

import { requestBadge } from "./request-card"

export function RequestStatusBadge({ request }: { request: Pick<EsignRequest, "status" | "myTurn" | "delivery"> }) {
  const { tone, label } = requestBadge(request)
  return <StatusBadge tone={tone}>{label}</StatusBadge>
}

/** A signer's state; the viewer's own turn has none, because the action card says "Your turn". */
export function SignerStatusBadge({
  signer,
  turn,
  mine,
  requestStatus,
}: {
  signer: EsignSigner
  turn: boolean
  mine: boolean
  requestStatus: EsignRequest["status"]
}) {
  if (signer.status === "signed") return <StatusBadge tone="success">Signed</StatusBadge>
  if (signer.status === "declined") return <StatusBadge tone="danger">Declined</StatusBadge>
  if (requestStatus !== "in_progress") return <StatusBadge tone="neutral">Not signed</StatusBadge>
  if (!turn) return <StatusBadge tone="neutral">Waiting</StatusBadge>
  return mine ? null : <StatusBadge tone="brand">Their turn</StatusBadge>
}

const STATUS_FILTERS = ["all", "in_progress", "completed", "closed"] as const

/** The requests list's status segment; "closed" is cancelled or declined. */
export type StatusFilter = (typeof STATUS_FILTERS)[number]

/** The `?status=` search param; an unknown value falls back to the default instead of failing the route. */
export function parseStatusFilter(value: string | undefined): StatusFilter | undefined {
  return STATUS_FILTERS.find((filter) => filter === value)
}

/** "1 of 2 signed". */
export function signedProgress(request: Pick<EsignRequest, "signers" | "signedCount">) {
  return `${request.signedCount} of ${request.signers.length} signed`
}

/** Marks the signed-in user in a list of people. */
export function YouChip() {
  return (
    <Chip size="tiny" className="shrink-0 border-transparent bg-(--pn-accent-soft) text-(--pn-accent)">
      You
    </Chip>
  )
}
