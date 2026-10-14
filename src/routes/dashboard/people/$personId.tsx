import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { getPerson } from "@/features/people/people.functions"
import { PersonPage } from "@/features/people/person-page"

export const Route = createFileRoute("/dashboard/people/$personId")({
  loader: ({ params }) => getPerson({ data: { id: params.personId } }),
  pendingComponent: PersonPending,
  component: PersonRoute,
})

function PersonPending() {
  return (
    <>
      <PageBar width="record" back={{ label: "people", link: { to: "/dashboard/people" } }} crumb="People" />
      <PageContent width="record">
        <RecordSkeleton label="Loading person…" />
      </PageContent>
    </>
  )
}

function PersonRoute() {
  return <PersonPage person={Route.useLoaderData()} />
}
