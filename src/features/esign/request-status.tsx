import { StatusBadge } from "@/components/primitives/status-badge"
import type { EsignRequest, EsignSigner } from "@/lib/api/types"

export function RequestStatusBadge({ request }: { request: Pick<EsignRequest, "status" | "myTurn" | "delivery"> }) {
  if (request.status === "in_progress")
    return request.myTurn ? (
      <StatusBadge tone="brand">Your turn</StatusBadge>
    ) : (
      <StatusBadge tone="warning">In progress</StatusBadge>
    )
  if (request.status === "completed")
    return request.delivery?.status === "failed" ? (
      <StatusBadge tone="danger">Delivery failed</StatusBadge>
    ) : (
      <StatusBadge tone="success">Signed</StatusBadge>
    )
  if (request.status === "declined") return <StatusBadge tone="danger">Declined</StatusBadge>
  return <StatusBadge tone="neutral">Cancelled</StatusBadge>
}

export function SignerStatusBadge({ signer, turn }: { signer: EsignSigner; turn: boolean }) {
  if (signer.status === "signed") return <StatusBadge tone="success">Signed</StatusBadge>
  if (signer.status === "declined") return <StatusBadge tone="danger">Declined</StatusBadge>
  return turn ? <StatusBadge tone="brand">To sign</StatusBadge> : <StatusBadge tone="neutral">Waiting</StatusBadge>
}

/** "1 of 2 signed". */
export function signedProgress(request: Pick<EsignRequest, "signers" | "signedCount">) {
  return `${request.signedCount} of ${request.signers.length} signed`
}
