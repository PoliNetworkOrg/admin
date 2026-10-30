import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { CapoPage } from "@/features/people/capo-page"
import { getCapoArea } from "@/features/people/people-capo.functions"

export const Route = createFileRoute("/dashboard/telegram/capo")({
  loader: () => getCapoArea(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={5} label="Loading your groups…" />
      </PageContent>
    </>
  ),
  component: CapoRoute,
})

function CapoRoute() {
  return <CapoPage area={Route.useLoaderData()} />
}
