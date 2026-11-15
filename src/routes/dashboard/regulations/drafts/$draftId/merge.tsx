import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { MergePage } from "@/features/regulations/merge-page"
import { getDraft, getDrafts, getRegulationDocument } from "@/features/regulations/regulations.functions"

const BACK = { label: "bozze", link: { to: "/dashboard/regulations/drafts" } } as const

/** The draft or version to merge in: `draft:<id>` or `version:<id>`; anything else is ignored. */
const fromSchema = z.string().regex(/^(draft|version):[\w-]{1,64}$/)

export const Route = createFileRoute("/dashboard/regulations/drafts/$draftId/merge")({
  validateSearch: (search: { from?: unknown }): { from?: string } => {
    const from = fromSchema.safeParse(search.from)
    return from.success ? { from: from.data } : {}
  },
  loader: async ({ params }) => {
    const draft = await getDraft({ data: { draftId: params.draftId } })
    const [drafts, { versions }] = await Promise.all([
      getDrafts({ data: { documentKey: draft.documentKey, includeClosed: false } }),
      getRegulationDocument({ data: { documentKey: draft.documentKey } }),
    ])
    return { draft, drafts: drafts.filter((other) => other.id !== draft.id), versions }
  },
  pendingComponent: () => (
    <>
      <PageBar back={BACK} crumb="Bozze" />
      <PageContent>
        <RecordSkeleton label="Caricamento…" />
      </PageContent>
    </>
  ),
  component: MergeRoute,
})

function MergeRoute() {
  const { draft, drafts, versions } = Route.useLoaderData()
  const { from } = Route.useSearch()
  return <MergePage draft={draft} drafts={drafts} versions={versions} from={from ?? null} />
}
