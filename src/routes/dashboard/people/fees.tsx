import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { FeesPage } from "@/features/soci/fees-page"
import { getSociFees } from "@/features/soci/soci.functions"

/** `?year=`: the fee year by its first calendar year (`2026` is 2026/27); this one when left out. */
const search = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() })

export const Route = createFileRoute("/dashboard/people/fees")({
  validateSearch: search,
  loaderDeps: ({ search: { year } }) => ({ year }),
  loader: ({ deps }) => getSociFees({ data: { year: deps.year } }),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={5} label="Loading fees…" />
      </PageContent>
    </>
  ),
  component: FeesRoute,
})

function FeesRoute() {
  const { fees, years } = Route.useLoaderData()
  return <FeesPage fees={fees} years={years} />
}
