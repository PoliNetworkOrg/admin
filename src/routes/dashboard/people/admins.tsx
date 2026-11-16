import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { AdminsPage } from "@/features/people/admins-page"
import { getAdminsAndCapos, getPeople } from "@/features/people/people.functions"

export const Route = createFileRoute("/dashboard/people/admins")({
  // Every record too: Make admin picks from them.
  loader: async () => {
    const [{ admins, capos }, people] = await Promise.all([getAdminsAndCapos(), getPeople()])
    return { admins, capos, people }
  },
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={4} label="Loading admins…" />
      </PageContent>
    </>
  ),
  component: AdminsRoute,
})

function AdminsRoute() {
  const { admins, capos, people } = Route.useLoaderData()
  return <AdminsPage admins={admins} capos={capos} people={people} />
}
