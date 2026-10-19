import { createFileRoute, redirect } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageBar, PageContent } from "@/components/shell"
import { EsignDrivesPage } from "@/features/esign/drives-page"
import { getEsignDriveAccess } from "@/features/esign/drives.functions"
import { hasPermission } from "@/server/permissions"

export const Route = createFileRoute("/dashboard/esign/drives")({
  beforeLoad: ({ context }) => {
    if (!hasPermission(context.permissions, "esign:drives:manage")) throw redirect({ to: "/unauthorized" })
  },
  loader: () => getEsignDriveAccess(),
  pendingComponent: () => (
    <>
      <PageBar width="settings" />
      <PageContent width="settings">
        <RecordSkeleton label="Loading the drives…" />
      </PageContent>
    </>
  ),
  component: DrivesRoute,
})

function DrivesRoute() {
  const { drives, catalog } = Route.useLoaderData()
  return <EsignDrivesPage drives={drives} catalog={catalog} />
}
