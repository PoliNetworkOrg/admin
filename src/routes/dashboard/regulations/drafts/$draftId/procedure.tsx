import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { ProcedurePage } from "@/features/regulations/procedure-page"
import {
  getDraftWithMembers,
  getEmanation,
  getRegulationDocumentInfo,
} from "@/features/regulations/regulations.functions"
import { hasPermission } from "@/server/permissions"

const BACK = { label: "bozze", link: { to: "/dashboard/regulations/drafts" } } as const

export const Route = createFileRoute("/dashboard/regulations/drafts/$draftId/procedure")({
  loader: async ({ params, context }) => {
    const data = { draftId: params.draftId }
    const { draft, members } = await getDraftWithMembers({ data })
    // Only an emanation that started has a status to show. The document says what publishing a `documento` does;
    // people admitted only by an assignment can't read documents, and can't publish either.
    const [emanation, document] = await Promise.all([
      draft.emanationStatus === "none" ? null : getEmanation({ data }),
      draft.procedure.key === "documento" && hasPermission(context.permissions, "regulations:read")
        ? getRegulationDocumentInfo({ data: { documentKey: draft.documentKey } })
        : null,
    ])
    return { draft, members, emanation, document }
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
  const { draft, members, emanation, document } = Route.useLoaderData()
  return <ProcedurePage draft={draft} members={members} emanation={emanation} document={document} />
}
