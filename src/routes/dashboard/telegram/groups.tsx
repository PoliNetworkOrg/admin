import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { TableSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import { listGroupLabels, listGroupsWithLabels } from "@/features/group-labels/group-labels.functions"
import { parseVisibility } from "@/features/groups/visibility"
import { TelegramGroupsPage } from "@/features/telegram/groups-page"
import { getTelegramGroups } from "@/features/telegram/groups.functions"

export const Route = createFileRoute("/dashboard/telegram/groups")({
  validateSearch: z.object({
    q: z.string().optional(),
    visibility: z.string().optional().transform(parseVisibility),
  }),
  loader: async () => {
    const [groups, groupLabels, groupsWithLabels] = await Promise.all([
      getTelegramGroups(),
      listGroupLabels(),
      listGroupsWithLabels(),
    ])
    return { groups, groupLabels, groupsWithLabels }
  },
  pendingComponent: () => (
    <PageContent width="wide">
      <TableSkeleton columns={5} label="Loading groups…" />
    </PageContent>
  ),
  component: TelegramGroupsRoute,
})

function TelegramGroupsRoute() {
  const { groups, groupLabels, groupsWithLabels } = Route.useLoaderData()
  const { q, visibility } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <TelegramGroupsPage
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
