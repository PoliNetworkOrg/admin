import { createFileRoute } from "@tanstack/react-router"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { DeletionPage } from "@/features/soci/deletion-page"
import { getPendingDeletion } from "@/features/soci/soci.functions"

export const Route = createFileRoute("/dashboard/people/deletion")({
  loader: () => getPendingDeletion(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={3} label="Loading accounts pending deletion…" />
      </PageContent>
    </>
  ),
  component: () => <DeletionPage accounts={Route.useLoaderData()} />,
})
