import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import { GuidesPage } from "@/features/guides/guides-page"
import { getGuides } from "@/features/guides/guides.functions"

export const Route = createFileRoute("/dashboard/web/guides")({
  loader: () => getGuides(),
  pendingComponent: GuidesPending,
  component: GuidesRoute,
})

function GuidesPending() {
  return (
    <PageContent>
      <TableSkeleton columns={4} rows={4} label="Loading editions…" />
    </PageContent>
  )
}

function GuidesRoute() {
  return <GuidesPage guides={Route.useLoaderData()} />
}
