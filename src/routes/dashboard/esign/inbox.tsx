import { createFileRoute, redirect } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { getEsignHome } from "@/features/esign/esign.functions"
import { EsignRequestsPage } from "@/features/esign/requests-page"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard/esign/inbox")({
  beforeLoad: ({ context }) => {
    if (!hasPermission(context.permissions, "esign:sign")) throw redirect({ to: "/unauthorized" })
  },
  loader: () => getEsignHome({ data: { scope: "inbox" } }),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={3} label="Loading documents to sign…" />
      </PageContent>
    </>
  ),
  component: InboxRoute,
})

function InboxRoute() {
  const { requests } = Route.useLoaderData()
  return <EsignRequestsPage requests={requests} scope="inbox" />
}
