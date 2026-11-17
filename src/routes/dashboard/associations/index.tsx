import { createFileRoute } from "@tanstack/react-router"

import { CardsSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { PortalIndex } from "@/features/association-portal/portal-index"
import { getPortal, getPortalDirectory } from "@/features/association-portal/portal.functions"

export const Route = createFileRoute("/dashboard/associations/")({
  loader: async () => {
    const [portal, directory] = await Promise.all([getPortal(), getPortalDirectory()])
    return { portal, directory }
  },
  pendingComponent: () => (
    <>
      <PageBar width="wide" />
      <PageContent width="wide">
        <CardsSkeleton label="Caricamento associazioni…" />
      </PageContent>
    </>
  ),
  component: Page,
})
function Page() {
  return <PortalIndex {...Route.useLoaderData()} />
}
