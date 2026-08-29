import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { listGroupLabels } from "@/features/group-labels/group-labels.functions"
import { getWhatsappGroupLabelRelations, getWhatsappGroups } from "@/features/whatsapp/groups.functions"
import { WhatsappGroupsPage } from "@/features/whatsapp/whatsapp-groups-page"

export const Route = createFileRoute("/dashboard/whatsapp/groups")({
  loader: async () => {
    const [groups, groupLabels, groupLabelRelations] = await Promise.all([
      getWhatsappGroups(),
      listGroupLabels(),
      getWhatsappGroupLabelRelations(),
    ])
    return { groups, groupLabels, groupLabelRelations }
  },
  pendingComponent: () => <DataPageSkeleton columns={4} />,
  component: WhatsappGroupsRoute,
})

function WhatsappGroupsRoute() {
  const { groups, groupLabels, groupLabelRelations } = Route.useLoaderData()
  return (
    <WhatsappGroupsPage
      loadedGroups={groups}
      loadedGroupLabels={groupLabels}
      loadedGroupLabelRelations={groupLabelRelations}
    />
  )
}
