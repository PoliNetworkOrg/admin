import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { DocumentPage } from "@/features/regulations/document-page"
import { getRegulationDocument } from "@/features/regulations/regulations.functions"

const BACK = { label: "documenti", link: { to: "/dashboard/regulations" } } as const

export const Route = createFileRoute("/dashboard/regulations/documents/$documentKey")({
  loader: ({ params }) => getRegulationDocument({ data: { documentKey: params.documentKey } }),
  pendingComponent: () => (
    <>
      <PageBar back={BACK} crumb="Documenti" />
      <PageContent>
        <TableSkeleton columns={4} label="Caricamento del documento…" />
      </PageContent>
    </>
  ),
  component: DocumentRoute,
})

function DocumentRoute() {
  const { document, versions, drafts } = Route.useLoaderData()
  return <DocumentPage document={document} versions={versions} drafts={drafts} />
}
