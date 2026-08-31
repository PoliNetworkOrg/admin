import { createFileRoute } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import { listGroupLabels, listGroupsWithLabels } from "@/features/group-labels/group-labels.functions"
import { getWhatsappGroups } from "@/features/whatsapp/groups.functions"
import { WhatsappGroupsPage } from "@/features/whatsapp/whatsapp-groups-page"

export const Route = createFileRoute("/dashboard/whatsapp/groups")({
  loader: async () => {
    const [groups, groupLabels, groupsWithLabels] = await Promise.all([
      getWhatsappGroups(),
      listGroupLabels(),
      listGroupsWithLabels(),
    ])
    return { groups, groupLabels, groupsWithLabels }
  },
  pendingComponent: () => <DataPageSkeleton columns={4} />,
  component: WhatsappGroupsRoute,
})

function WhatsappGroupsRoute() {
  const { groups, groupLabels, groupsWithLabels } = Route.useLoaderData()
  return (
    <WhatsappGroupsPage
      loadedGroups={groups}
      loadedGroupLabels={groupLabels}
      loadedGroupsWithLabels={groupsWithLabels}
    />
  )
}
