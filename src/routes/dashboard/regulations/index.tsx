import { createFileRoute } from "@tanstack/react-router"

import { CardsSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { DocumentsPage } from "@/features/regulations/documents-page"
import { getRegulationDocuments } from "@/features/regulations/regulations.functions"

export const Route = createFileRoute("/dashboard/regulations/")({
  loader: () => getRegulationDocuments(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <CardsSkeleton label="Caricamento dei documenti…" />
      </PageContent>
    </>
  ),
  component: DocumentsRoute,
})

function DocumentsRoute() {
  return <DocumentsPage documents={Route.useLoaderData()} />
}
