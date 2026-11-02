import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { ProcedurePage } from "@/features/regulations/procedure-page"
import { getDraftWithMembers, getEmanation } from "@/features/regulations/regulations.functions"

const BACK = { label: "bozze", link: { to: "/dashboard/regulations/drafts" } } as const

export const Route = createFileRoute("/dashboard/regulations/drafts/$draftId/procedure")({
  loader: async ({ params }) => {
    const data = { draftId: params.draftId }
    const [{ draft, members }, emanation] = await Promise.all([getDraftWithMembers({ data }), getEmanation({ data })])
    return { draft, members, emanation }
  },
  pendingComponent: () => (
    <>
      <PageBar width="record" back={BACK} crumb="Bozze" />
      <PageContent width="record">
        <RecordSkeleton label="Caricamento della procedura…" />
      </PageContent>
    </>
  ),
  component: ProcedureRoute,
})

function ProcedureRoute() {
  const { draft, members, emanation } = Route.useLoaderData()
  return <ProcedurePage draft={draft} members={members} emanation={emanation} />
}
