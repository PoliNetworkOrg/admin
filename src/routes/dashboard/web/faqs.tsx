import { createFileRoute } from "@tanstack/react-router"
import { DataPageSkeleton } from "@/components/loading-skeleton"
import FaqsPage from "@/features/faqs/faqs-page"

export const Route = createFileRoute("/dashboard/web/faqs")({
  //loader: () => getAllFaqs(),
  pendingComponent: () => <DataPageSkeleton columns={2} />,
  component: AssociationsRoute,
})

function AssociationsRoute() {
  return <FaqsPage />
}
