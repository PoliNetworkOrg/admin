import { createFileRoute, redirect } from "@tanstack/react-router"
import { z } from "zod"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { AuditLogPage } from "@/features/audit-log/audit-log-page"
import { AUDIT_AREAS, AUDIT_OUTCOMES, getAuditEvents } from "@/features/audit-log/audit-log.functions"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard/audit-log/")({
  validateSearch: z.object({
    q: z.string().optional(),
    area: z.enum(AUDIT_AREAS).optional(),
    outcome: z.enum(AUDIT_OUTCOMES).optional(),
    event: z.number().int().positive().optional(),
  }),
  beforeLoad: ({ context }) => {
    if (!hasPermission(context.permissions, "audit:read")) throw redirect({ to: "/unauthorized" })
  },
  // Opening an event changes `event` only, which does not reload the list.
  loaderDeps: ({ search }) => ({ q: search.q?.trim() ?? "", area: search.area, outcome: search.outcome }),
  loader: async ({ deps }) => ({
    filters: deps,
    page: await getAuditEvents({ data: { area: deps.area, outcome: deps.outcome, search: deps.q || undefined } }),
  }),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={5} label="Loading events…" />
      </PageContent>
    </>
  ),
  component: AuditLogRoute,
})

function AuditLogRoute() {
  const { page, filters } = Route.useLoaderData()
  const { event } = Route.useSearch()
  // A new search or filter starts over from the newest page.
  return <AuditLogPage key={JSON.stringify(filters)} page={page} filters={filters} eventId={event} />
}
