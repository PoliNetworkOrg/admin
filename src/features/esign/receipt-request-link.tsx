import { Link } from "@tanstack/react-router"

import { useCan, useHasAdminAccess } from "@/components/shell"
import type { ReceiptRequestSource } from "@/features/people/people.contract"

/** The receipt remains identifiable to signers who cannot open the member register. */
export function ReceiptRequestLink({ source }: { source: ReceiptRequestSource }) {
  const canRead = useCan("people:members:read")
  const hasAdminAccess = useHasAdminAccess()
  const label = `Fee receipt ${source.number} · ${source.year}`
  return canRead && hasAdminAccess ? (
    <Link
      to="/dashboard/people/receipts"
      search={{ year: source.year, q: source.number }}
      className="text-[13px] text-(--pn-accent) hover:underline"
    >
      {label}
    </Link>
  ) : (
    <span className="text-[13px] text-(--pn-fg-muted)">{label}</span>
  )
}
