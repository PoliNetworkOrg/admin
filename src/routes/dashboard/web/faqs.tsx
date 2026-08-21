import { createFileRoute } from "@tanstack/react-router"
import { DataPageSkeleton } from "@/components/loading-skeleton"
import { listFAQs } from "@/features/faqs/faqs.functions"
import FAQsPage from "@/features/faqs/faqs-page"

export const Route = createFileRoute("/dashboard/web/faqs")({
  loader: () => listFAQs(),
  pendingComponent: () => <DataPageSkeleton columns={1} />,
  component: FAQsRoute,
})

function FAQsRoute() {
  const initFAQs = Route.useLoaderData()
  return <FAQsPage initFAQs={initFAQs} />
}
