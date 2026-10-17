import { createFileRoute, redirect } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { EsignBatchPage } from "@/features/esign/batch-page"
import { getEsignBatch } from "@/features/esign/esign.functions"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard/esign/sign")({
  beforeLoad: ({ context }) => {
    if (!hasPermission(context.permissions, "esign:sign")) throw redirect({ to: "/unauthorized" })
  },
  loader: () => getEsignBatch(),
  pendingComponent: () => (
    <>
      <PageBar width="record" back={{ label: "documents to sign", link: { to: "/dashboard/esign/inbox" } }} />
      <PageContent width="record">
        <RecordSkeleton label="Loading the documents…" />
      </PageContent>
    </>
  ),
  component: SignRoute,
})

function SignRoute() {
  const batch = Route.useLoaderData()
  return <EsignBatchPage {...batch} />
}
