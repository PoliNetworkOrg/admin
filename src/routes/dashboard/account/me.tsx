import { createFileRoute } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { MyAreaPage } from "@/features/people/my-area-page"
import { getMyArea } from "@/features/people/people-self.functions"
import { getMySocio } from "@/features/soci/soci-self.functions"

export const Route = createFileRoute("/dashboard/account/me")({
  // The socio record comes from Soci, not People: when it can't be read, My area still opens and says so in its place.
  loader: async () => {
    const [area, socio] = await Promise.all([
      getMyArea(),
      getMySocio().catch((error) => {
        console.error(error)
        return "error" as const
      }),
    ])
    return { area, socio }
  },
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
  const { area, socio } = Route.useLoaderData()
  return <MyAreaPage area={area} socio={socio} />
}
