import { createFileRoute } from "@tanstack/react-router"

import { PagePlaceholder } from "@/features/people/page-placeholder"

export const Route = createFileRoute("/dashboard/people/teams/")({
  component: PagePlaceholder,
})
