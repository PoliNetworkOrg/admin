import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { EventQueue } from "@/features/association-portal/portal-calendar"
import { getPortalEventQueue } from "@/features/association-portal/portal-review.functions"
import { calendarEventQueueSchema } from "@/features/association-portal/portal.contract"

export const Route = createFileRoute("/dashboard/associations/events/")({
  // By default the queue opens on what waits for a decision.
  validateSearch: (search) => {
    const parsed = calendarEventQueueSchema.safeParse(search)
    return parsed.success ? parsed.data : {}
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => ({
    filter: deps,
    events: await getPortalEventQueue({ data: deps }),
  }),
  pendingComponent: () => (
    <>
      <PageBar width="wide" />
      <PageContent width="wide">
        <TableSkeleton columns={4} label="Caricamento eventi…" />
      </PageContent>
    </>
  ),
  component: Page,
})
function Page() {
  const { filter, events } = Route.useLoaderData()
  return <EventQueue events={events} filter={filter} />
}
