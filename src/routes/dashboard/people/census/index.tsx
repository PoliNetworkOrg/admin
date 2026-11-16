import { createFileRoute } from "@tanstack/react-router"

import { CensusPage } from "@/features/people/census-page"

// An unconnected mockup (Phase 3, #145): no loader, nothing is read from the backend.
export const Route = createFileRoute("/dashboard/people/census/")({
  component: CensusPage,
})
