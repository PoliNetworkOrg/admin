import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { DraftsPage } from "@/features/regulations/drafts-page"
import { getDrafts, getMyRegulations, getRegulationDocuments } from "@/features/regulations/regulations.functions"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard/regulations/drafts/")({
  // Emanated drafts too: they keep their history and differences. Documents, to start a draft, need `regulations:read`.
  loader: async ({ context }) => {
    const [drafts, me, documents] = await Promise.all([
      getDrafts({ data: { includeClosed: true } }),
      getMyRegulations(),
      hasPermission(context.permissions, "regulations:write") ? getRegulationDocuments() : [],
    ])
    return { drafts, me, documents }
  },
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={5} label="Caricamento delle bozze…" />
      </PageContent>
    </>
  ),
  component: DraftsRoute,
})

function DraftsRoute() {
  const { drafts, me, documents } = Route.useLoaderData()
  return <DraftsPage drafts={drafts} me={me} documents={documents} />
}
