import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { getEsignHome } from "@/features/esign/esign.functions"
import { parseStatusFilter } from "@/features/esign/request-status"
import { EsignRequestsPage } from "@/features/esign/requests-page"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard/esign/requests/")({
  validateSearch: z.object({
    scope: z.enum(["mine", "all"]).optional(),
    status: z.string().optional().transform(parseStatusFilter),
  }),
  beforeLoad: ({ context }) => {
    if (!hasPermission(context.permissions, "esign:sign")) throw redirect({ to: "/unauthorized" })
  },
  // `status` filters in the page, so changing it doesn't reload.
  loaderDeps: ({ search }) => ({ scope: search.scope ?? "mine" }),
  // Without the manage permission everyone only sees their own requests.
  loader: async ({ deps, context }) => {
    const scope: "all" | "mine" =
      deps.scope === "all" && hasPermission(context.permissions, "esign:requests:manage") ? "all" : "mine"
    return { scope, ...(await getEsignHome({ data: { scope } })) }
  },
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={4} label="Loading requests…" />
      </PageContent>
    </>
  ),
  component: RequestsRoute,
})

function RequestsRoute() {
  const { requests, scope } = Route.useLoaderData()
  const { status } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <EsignRequestsPage
      requests={requests}
      scope={scope}
      status={status ?? "all"}
      onStatusChange={(next) =>
        void navigate({
          search: (previous) => ({ ...previous, status: next === "all" ? undefined : next }),
          replace: true,
        })
      }
    />
  )
}
