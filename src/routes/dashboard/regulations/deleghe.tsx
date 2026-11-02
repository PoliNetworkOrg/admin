import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { DeleghePage } from "@/features/regulations/deleghe-page"
import { getDeleghe, getRegulationDocuments } from "@/features/regulations/regulations.functions"

export const Route = createFileRoute("/dashboard/regulations/deleghe")({
  loader: async () => {
    const [deleghe, documents] = await Promise.all([getDeleghe(), getRegulationDocuments()])
    return { deleghe, documents }
  },
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={5} label="Caricamento delle deleghe…" />
      </PageContent>
    </>
  ),
  component: DelegheRoute,
})

function DelegheRoute() {
  const { deleghe, documents } = Route.useLoaderData()
  return <DeleghePage deleghe={deleghe} documents={documents} />
}
