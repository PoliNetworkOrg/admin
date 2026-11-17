import { createFileRoute } from "@tanstack/react-router"

import { PortalDetail } from "@/features/association-portal/portal-detail"
import { getPortalAssociation } from "@/features/association-portal/portal.functions"

export const Route = createFileRoute("/dashboard/associations/$id")({
  loader: ({ params }) => getPortalAssociation({ data: { id: params.id } }),
  component: Page,
})
function Page() {
  const association = Route.useLoaderData()
  return <PortalDetail key={association.id} association={association} />
}
