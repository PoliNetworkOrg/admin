import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { MyAreaPage } from "@/features/people/my-area-page"
import { getMyArea } from "@/features/people/people-self.functions"

export const Route = createFileRoute("/dashboard/account/me")({
  loader: () => getMyArea(),
  pendingComponent: () => (
    <>
      <PageBar />
      <PageContent>
        <RecordSkeleton label="Loading your area…" />
      </PageContent>
    </>
  ),
  component: MyAreaRoute,
})

function MyAreaRoute() {
  return <MyAreaPage area={Route.useLoaderData()} />
}
