import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { MembersPage } from "@/features/people/members-page"
import { getPeople } from "@/features/people/people.functions"

export const Route = createFileRoute("/dashboard/people/members")({
  validateSearch: z.object({ add: z.string().optional() }),
  loader: () => getPeople(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={6} label="Loading members…" />
      </PageContent>
    </>
  ),
  component: MembersRoute,
})

function MembersRoute() {
  const { add } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <MembersPage
      people={Route.useLoaderData()}
      addPersonId={add}
      onAddHandled={() => {
        navigate({ search: {}, replace: true }).catch((error) => console.error(error))
      }}
    />
  )
}
