import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { TableSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import { listGroupLabels, listGroupsWithLabels } from "@/features/group-labels/group-labels.functions"
import { parseVisibility } from "@/features/groups/labels-filter-popover"
import { getWhatsappGroups } from "@/features/whatsapp/groups.functions"
import { WhatsappGroupsPage } from "@/features/whatsapp/whatsapp-groups-page"

export const Route = createFileRoute("/dashboard/whatsapp/groups")({
  validateSearch: z.object({
    q: z.string().optional(),
    visibility: z.string().optional().transform(parseVisibility),
  }),
  loader: async () => {
    const [groups, groupLabels, groupsWithLabels] = await Promise.all([
      getWhatsappGroups(),
      listGroupLabels(),
      listGroupsWithLabels(),
    ])
    return { groups, groupLabels, groupsWithLabels }
  },
  pendingComponent: () => (
    <PageContent width="wide">
      <TableSkeleton columns={3} label="Loading groups…" />
    </PageContent>
  ),
  component: WhatsappGroupsRoute,
})

function WhatsappGroupsRoute() {
  const { groups, groupLabels, groupsWithLabels } = Route.useLoaderData()
  const { q, visibility } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <WhatsappGroupsPage
      groups={groups}
      labels={groupLabels}
      groupsWithLabels={groupsWithLabels}
      initialQuery={q ?? ""}
      visibility={visibility ?? "all"}
      onVisibilityChange={(next) =>
        void navigate({
          search: (previous) => ({ ...previous, visibility: next === "all" ? undefined : next }),
          replace: true,
        })
      }
    />
  )
}
