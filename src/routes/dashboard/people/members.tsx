import { createFileRoute } from "@tanstack/react-router"

import { MembersPage } from "@/features/people/members-page"

// An unconnected mockup (Phase 2, #144): no loader, nothing is read from the backend.
export const Route = createFileRoute("/dashboard/people/members")({
  component: MembersPage,
})
