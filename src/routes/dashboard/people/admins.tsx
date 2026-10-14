import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { AdminsPage } from "@/features/people/admins-page"
import { getPeople } from "@/features/people/people.functions"

export const Route = createFileRoute("/dashboard/people/admins")({
  loader: () => getPeople(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={6} label="Loading admins…" />
      </PageContent>
    </>
  ),
  component: AdminsRoute,
})

function AdminsRoute() {
  return <AdminsPage people={Route.useLoaderData()} />
}
