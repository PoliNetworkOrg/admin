import { createFileRoute } from "@tanstack/react-router"

import { WorkspaceSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { EditorPage } from "@/features/regulations/editor/editor-page"
import { getDraftWithMembers } from "@/features/regulations/regulations.functions"

const DRAFTS_BACK = { label: "bozze", link: { to: "/dashboard/regulations/drafts" } } as const

export const Route = createFileRoute("/dashboard/regulations/drafts/$draftId/")({
  loader: ({ params }) => getDraftWithMembers({ data: { draftId: params.draftId } }),
  pendingComponent: () => (
    <>
      <PageBar back={DRAFTS_BACK} crumb="Bozze" />
      <PageContent fill>
        <WorkspaceSkeleton label="Apertura dell'editor…" document />
      </PageContent>
    </>
  ),
  component: EditorRoute,
})

function EditorRoute() {
  const { draft, members } = Route.useLoaderData()
  // A new editor per draft: its Yjs document and connection belong to one draft.
  return <EditorPage key={draft.id} draft={draft} members={members} />
}
