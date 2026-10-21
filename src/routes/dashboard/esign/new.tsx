import { createFileRoute, redirect } from "@tanstack/react-router"

import { WorkspaceSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { NewEsignRequestPage } from "@/features/esign/new-request-page"
import { getEsignComposer } from "@/features/esign/requests.functions"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard/esign/new")({
  beforeLoad: ({ context }) => {
    if (!hasPermission(context.permissions, "esign:requests:manage")) throw redirect({ to: "/unauthorized" })
  },
  loader: () => getEsignComposer(),
  pendingComponent: () => (
    <>
      <PageBar
        width="record"
        back={{ label: "requests", link: { to: "/dashboard/esign/requests" } }}
        context="New request"
      />
      <PageContent width="record" fill>
        <WorkspaceSkeleton label="Loading…" />
      </PageContent>
    </>
  ),
  component: NewRequestRoute,
})

function NewRequestRoute() {
  const { config, signers, me } = Route.useLoaderData()
  return <NewEsignRequestPage config={config} signers={signers} me={me} />
}
