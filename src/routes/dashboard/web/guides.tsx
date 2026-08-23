import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { GuidesPage } from "@/features/guides/guides-page"
import { getGuides } from "@/features/guides/guides.functions"

export const Route = createFileRoute("/dashboard/web/guides")({
  loader: () => getGuides(),
  pendingComponent: () => <DataPageSkeleton columns={4} />,
  component: GuidesRoute,
})

function GuidesRoute() {
  return <GuidesPage loadedGuides={Route.useLoaderData()} />
}
