import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { TableSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { getReceipts } from "@/features/people/people-receipts.functions"
import { ReceiptsPage } from "@/features/people/receipts-page"

export const Route = createFileRoute("/dashboard/people/receipts")({
  validateSearch: z.object({
    q: z.string().max(120).optional(),
    year: z
      .string()
      .regex(/^\d{4}\/\d{2}$/)
      .optional(),
  }),
  loaderDeps: ({ search }) => ({ year: search.year ?? null }),
  loader: ({ deps }) => getReceipts({ data: { year: deps.year } }),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <TableSkeleton columns={6} label="Loading receipts…" />
      </PageContent>
    </>
  ),
  component: ReceiptsRoute,
})

function ReceiptsRoute() {
  const navigate = Route.useNavigate()
  const page = Route.useLoaderData()
  const { q } = Route.useSearch()
  return (
    <ReceiptsPage
      key={`${page.year}-${q ?? ""}`}
      page={page}
      initialQuery={q ?? ""}
      onYear={(year) => {
        navigate({ search: year === page.years[0] ? {} : { year } }).catch((error) => console.error(error))
      }}
    />
  )
}
