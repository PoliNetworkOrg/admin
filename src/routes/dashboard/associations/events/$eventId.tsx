import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { getPortalEvent } from "@/features/association-portal/event.functions"
import { EventPage } from "@/features/association-portal/portal-calendar"
import { getPortalCatalogue } from "@/features/association-portal/portal.functions"

export const Route = createFileRoute("/dashboard/associations/events/$eventId")({
  loader: async ({ params }) => {
    const [event, catalogue] = await Promise.all([
      getPortalEvent({ data: { id: params.eventId } }),
      getPortalCatalogue(),
    ])
    return { event, catalogue }
  },
  pendingComponent: () => (
    <>
      <PageBar back={{ label: "Associazioni", link: { to: "/dashboard/associations" } }} />
      <PageContent width="record">
        <RecordSkeleton label="Caricamento evento…" />
      </PageContent>
    </>
  ),
  component: Page,
})
function Page() {
  const { event, catalogue } = Route.useLoaderData()
  return <EventPage key={event.id} event={event} catalogue={catalogue} />
}
