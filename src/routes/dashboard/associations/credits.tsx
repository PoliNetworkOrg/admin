import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { CreditsPage } from "@/features/association-portal/portal-credits"
import { getCreditConfig } from "@/features/association-portal/portal-review.functions"

export const Route = createFileRoute("/dashboard/associations/credits")({
  loader: () => getCreditConfig(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent width="record">
        <RecordSkeleton label="Caricamento regole…" />
      </PageContent>
    </>
  ),
  component: Page,
})
function Page() {
  return <CreditsPage config={Route.useLoaderData()} />
}
