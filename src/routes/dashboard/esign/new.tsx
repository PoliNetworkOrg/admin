import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

import { WorkspaceSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { NewEsignRequestPage } from "@/features/esign/new-request-page"
import { getEsignComposer } from "@/features/esign/requests.functions"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard/esign/new")({
  // `?from=<request id>` starts from an earlier request ("Send again"). Any value reaches the loader as text, which says
  // when it isn't a request that can be read: the router reads `?from=123` as a number.
  validateSearch: z.object({ from: z.coerce.string().optional() }),
  beforeLoad: ({ context }) => {
    if (!hasPermission(context.permissions, "esign:requests:manage")) throw redirect({ to: "/unauthorized" })
  },
  loaderDeps: ({ search }) => ({ from: search.from }),
  loader: ({ deps }) => getEsignComposer({ data: { from: deps.from } }),
  pendingComponent: NewRequestPending,
  component: NewRequestRoute,
})

function NewRequestPending() {
  // Sent again from an earlier request, the composer opens on its PDF, not on the chooser.
  const { from } = Route.useSearch()
  return (
    <>
      <PageBar
        width="record"
        back={{ label: "requests", link: { to: "/dashboard/esign/requests" } }}
        context="New request"
      />
      <PageContent width="record" fill>
        <WorkspaceSkeleton label="Loading…" document={from !== undefined} />
      </PageContent>
    </>
  )
}

function NewRequestRoute() {
  const { config, signers, me, source, sourceError } = Route.useLoaderData()
  const { from } = Route.useSearch()
  // Another request to start from is another composer.
  return (
    <NewEsignRequestPage
      key={from ?? ""}
      config={config}
      signers={signers}
      me={me}
      source={source}
      sourceError={sourceError}
    />
  )
}
