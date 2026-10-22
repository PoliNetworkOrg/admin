import { createFileRoute, redirect } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { getEsignRequest } from "@/features/esign/esign.functions"
import { EsignRequestPage } from "@/features/esign/request-page"
import { hasPermission } from "@/server/permissions"

const BACK = { label: "requests", link: { to: "/dashboard/esign/requests" } } as const

export const Route = createFileRoute("/dashboard/esign/requests/$requestId")({
  beforeLoad: ({ context }) => {
    if (!hasPermission(context.permissions, "esign:sign")) throw redirect({ to: "/unauthorized" })
  },
  loader: ({ params }) => getEsignRequest({ data: { id: params.requestId } }),
  pendingComponent: () => (
    <>
      <PageBar width="record" back={BACK} />
      <PageContent width="record">
        <RecordSkeleton label="Loading the request…" />
      </PageContent>
    </>
  ),
  component: RequestRoute,
})

function RequestRoute() {
  const detail = Route.useLoaderData()
  // A new instance per request, so state such as where the viewer opens starts over after "Next to sign".
  return <EsignRequestPage key={detail.request.id} detail={detail} />
}
