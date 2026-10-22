import { createFileRoute, redirect, useRouterState } from "@tanstack/react-router"
import { z } from "zod"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { EsignBatchPage } from "@/features/esign/batch-page"
import { getEsignBatch } from "@/features/esign/esign.functions"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard/esign/sign")({
  // `first`: the request "Sign n together" came from, which leads the batch already checked.
  validateSearch: z.object({ first: z.uuid().optional() }),
  beforeLoad: ({ context }) => {
    if (!hasPermission(context.permissions, "esign:sign")) throw redirect({ to: "/unauthorized" })
  },
  loaderDeps: ({ search }) => ({ first: search.first }),
  loader: ({ deps }) => getEsignBatch({ data: { first: deps.first } }),
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
  // Boxes the viewer moved on the request page they came from.
  const moved = useRouterState({ select: (state) => state.location.state.esignMoved })
  return <EsignBatchPage {...batch} moved={moved} />
}
