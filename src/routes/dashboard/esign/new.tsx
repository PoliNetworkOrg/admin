import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { NewEsignRequestPage } from "@/features/esign/new-request-page"
import { getEsignComposer } from "@/features/esign/requests.functions"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard/esign/new")({
  // `self`: "Sign a document", which starts with the viewer as the first signer. `from`: "Send again" on a declined
  // or cancelled request, which the composer will start from.
  validateSearch: z.object({ self: z.boolean().optional(), from: z.uuid().optional() }),
  beforeLoad: ({ context }) => {
    if (!hasPermission(context.permissions, "esign:requests:manage")) throw redirect({ to: "/unauthorized" })
  },
  loader: () => getEsignComposer(),
  pendingComponent: () => (
    <>
      <PageBar width="record" back={{ label: "requests", link: { to: "/dashboard/esign/requests" } }} />
      <PageContent width="record">
        <RecordSkeleton label="Loading…" />
      </PageContent>
    </>
  ),
  component: NewRequestRoute,
})

function NewRequestRoute() {
  const { config, signers, me } = Route.useLoaderData()
  const { self } = Route.useSearch()
  return <NewEsignRequestPage config={config} signers={signers} me={me} withMe={self === true} />
}
