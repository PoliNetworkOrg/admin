import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { getCampaigns } from "@/features/people/people-census.functions"
import { getPerson } from "@/features/people/people.functions"
import { PersonPage } from "@/features/people/person-page"

export const Route = createFileRoute("/dashboard/people/$personId")({
  loader: async ({ params }) => {
    const [person, campaigns] = await Promise.all([getPerson({ data: { id: params.personId } }), getCampaigns()])
    return { person, campaigns }
  },
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
  const { person, campaigns } = Route.useLoaderData()
  return <PersonPage person={person} campaigns={campaigns} />
}
