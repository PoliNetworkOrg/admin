import { createFileRoute } from "@tanstack/react-router"

import { CardsSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { PortalIndex } from "@/features/association-portal/portal-index"
import {
  getPortal,
  getPortalCatalogue,
  getPortalDirectory,
  getPortalHome,
} from "@/features/association-portal/portal.functions"

const views = ["registry", "requests", "directory"] as const
export const Route = createFileRoute("/dashboard/associations/")({
  validateSearch: (search): { view?: (typeof views)[number] } => {
    const view = views.find((v) => v === search.view)
    return view ? { view } : {}
  },
  loader: async () => {
    const [portal, directory, catalogue, home] = await Promise.all([
      getPortal(),
      getPortalDirectory(),
      getPortalCatalogue(),
      getPortalHome(),
    ])
    return { portal, directory, catalogue, home }
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
  const { view } = Route.useSearch()
  return <PortalIndex key={view ?? "registry"} {...Route.useLoaderData()} initialView={view} />
}
