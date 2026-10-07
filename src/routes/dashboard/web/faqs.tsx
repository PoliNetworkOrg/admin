import { createFileRoute } from "@tanstack/react-router"

import { SettingsListSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import { FAQsPage } from "@/features/faqs/faqs-page"
import { listFAQs } from "@/features/faqs/faqs.functions"

export const Route = createFileRoute("/dashboard/web/faqs")({
  loader: () => listFAQs(),
  pendingComponent: FAQsPending,
  component: FAQsRoute,
})

function FAQsPending() {
  return (
    <PageContent>
      {/* The accordion surface: 56px rows with the IT and EN questions and the row actions. */}
      <div className="overflow-hidden rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface) px-5">
        <SettingsListSkeleton rows={6} label="Loading FAQs…" />
      </div>
    </PageContent>
  )
}

function FAQsRoute() {
  return <FAQsPage categories={Route.useLoaderData()} />
}
