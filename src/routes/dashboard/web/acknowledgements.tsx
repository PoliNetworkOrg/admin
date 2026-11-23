import { createFileRoute } from "@tanstack/react-router"

import { SettingsListSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { AcknowledgementsPage } from "@/features/acknowledgements/acknowledgements-page"
import { getAcknowledgements } from "@/features/acknowledgements/acknowledgements.functions"

export const Route = createFileRoute("/dashboard/web/acknowledgements")({
  loader: () => getAcknowledgements(),
  pendingComponent: AcknowledgementsPending,
  component: AcknowledgementsRoute,
})

function AcknowledgementsPending() {
  return (
    <>
      <PageBar />
      <PageContent>
        {/* The people list surface: 56px rows with the name, its detail and the row actions. */}
        <div className="overflow-hidden rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface) px-5">
          <SettingsListSkeleton rows={6} label="Caricamento dei riconoscimenti…" />
        </div>
      </PageContent>
    </>
  )
}

function AcknowledgementsRoute() {
  return <AcknowledgementsPage data={Route.useLoaderData()} />
}
