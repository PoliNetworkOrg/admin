import { createFileRoute } from "@tanstack/react-router"

import { SettingsListSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { DocumentsPage } from "@/features/documents/documents-page"
import { getDocumentsCatalog } from "@/features/documents/documents.functions"

export const Route = createFileRoute("/dashboard/web/documents")({
  loader: () => getDocumentsCatalog(),
  pendingComponent: DocumentsPending,
  component: DocumentsRoute,
})

function DocumentsPending() {
  return (
    <>
      <PageBar />
      <PageContent>
        {/* The document list surface: 56px rows with the title, public link and current version. */}
        <div className="overflow-hidden rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface) px-5">
          <SettingsListSkeleton rows={6} label="Loading documents…" />
        </div>
      </PageContent>
    </>
  )
}

function DocumentsRoute() {
  return <DocumentsPage categories={Route.useLoaderData()} />
}
