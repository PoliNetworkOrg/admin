import { createFileRoute, redirect } from "@tanstack/react-router"

import { DataPageSkeleton } from "@/components/loading-skeleton"
import {
  listGroupLabels,
  listGroupsForLabels,
  listGroupsWithLabels,
} from "@/features/group-labels/group-labels.functions"
import { isCategoryLabel, labelPathToUrlSegments } from "@/features/group-labels/label-tree"
import { TagGroupsPage } from "@/features/groups-by-label/tag-groups-page"

export const Route = createFileRoute("/dashboard/web/tags/$tag")({
  beforeLoad: ({ params }) => {
    // A category already has a browsable page of its own — routing it here too would be a second, competing view
    // of the same label, reachable by hand-typing a URL.
    if (isCategoryLabel(params.tag)) {
      const to: string = `/dashboard/web/groups-by-label/${labelPathToUrlSegments(params.tag).join("/")}`
      throw redirect({ to })
    }
  },
  loader: async () => {
    const [groups, groupLabels, groupsWithLabels] = await Promise.all([
      listGroupsForLabels(),
      listGroupLabels(),
      listGroupsWithLabels(),
    ])
    return { ...groups, groupLabels, groupsWithLabels }
  },
  pendingComponent: () => <DataPageSkeleton columns={5} />,
  component: TagGroupsRoute,
})

function TagGroupsRoute() {
  const { tag } = Route.useParams()
  const { tgGroups, groupLabels, groupsWithLabels, waGroups } = Route.useLoaderData()

  return (
    <TagGroupsPage
      tag={tag}
      loadedTgGroups={tgGroups}
      loadedGroupLabels={groupLabels}
      loadedGroupsWithLabels={groupsWithLabels}
      loadedWaGroups={waGroups}
    />
  )
}
