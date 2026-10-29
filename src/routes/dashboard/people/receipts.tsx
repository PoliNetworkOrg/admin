import { createFileRoute } from "@tanstack/react-router"

import { ReceiptsPage } from "@/features/people/receipts-page"

// An unconnected mockup (Phase 2, #144): no loader, nothing is read from the backend.
export const Route = createFileRoute("/dashboard/people/receipts")({
  component: ReceiptsPage,
})
