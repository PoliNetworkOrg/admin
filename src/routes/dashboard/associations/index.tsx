import { createFileRoute } from "@tanstack/react-router"

import { PortalIndex } from "@/features/association-portal/portal-index"
import { getPortal, getPortalDirectory } from "@/features/association-portal/portal.functions"

export const Route = createFileRoute("/dashboard/associations/")({
  loader: async () => ({ portal: await getPortal(), directory: await getPortalDirectory() }),
  component: Page,
})
function Page() {
  return <PortalIndex {...Route.useLoaderData()} />
}
