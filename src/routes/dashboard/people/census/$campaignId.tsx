import { createFileRoute } from "@tanstack/react-router"

import { PagePlaceholder } from "@/features/people/page-placeholder"

export const Route = createFileRoute("/dashboard/people/census/$campaignId")({
  component: PagePlaceholder,
})
