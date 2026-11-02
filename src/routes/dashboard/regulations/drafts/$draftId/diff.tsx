import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { DiffPage } from "@/features/regulations/diff-page"
import { getDiff, getDraft } from "@/features/regulations/regulations.functions"

const BACK = { label: "bozze", link: { to: "/dashboard/regulations/drafts" } } as const

export const Route = createFileRoute("/dashboard/regulations/drafts/$draftId/diff")({
  loader: async ({ params }) => {
    const data = { draftId: params.draftId }
    const [draft, diff] = await Promise.all([getDraft({ data }), getDiff({ data })])
    return { draft, diff }
  },
  pendingComponent: () => (
    <>
      <PageBar back={BACK} crumb="Bozze" />
      <PageContent>
        <RecordSkeleton label="Caricamento delle differenze…" />
      </PageContent>
    </>
  ),
  component: DiffRoute,
})

function DiffRoute() {
  const { draft, diff } = Route.useLoaderData()
  return <DiffPage draft={draft} diff={diff} />
}
