import { createFileRoute, redirect } from "@tanstack/react-router"

import { RecordSkeleton } from "@/components/primitives"
import { PageContent } from "@/components/shell"
import {
  listGroupLabels,
  listGroupsForLabels,
  listGroupsWithLabels,
} from "@/features/group-labels/group-labels.functions"
import { isCategoryLabel, labelPathToUrlSegments } from "@/features/group-labels/label-tree"
import { TagGroupsPage } from "@/features/groups-by-label/tag-groups-page"

export const Route = createFileRoute("/dashboard/web/tags/$tag")({
  beforeLoad: ({ params }) => {
    // A category already has a browsable page of its own; routing it here too would be a second, competing view
    // of the same label, reachable by hand-typing a URL.
    if (isCategoryLabel(params.tag)) {
      throw redirect({
        to: "/dashboard/web/groups-by-label/$",
        params: { _splat: labelPathToUrlSegments(params.tag).join("/") },
      })
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
  pendingComponent: TagPending,
  component: TagGroupsRoute,
})

function TagPending() {
  return (
    <PageContent width="wide">
      <RecordSkeleton label="Loading tag…" />
    </PageContent>
  )
}

function TagGroupsRoute() {
  const { tag } = Route.useParams()
  const { tgGroups, groupLabels, groupsWithLabels } = Route.useLoaderData()

  return <TagGroupsPage key={tag} tag={tag} labels={groupLabels} groups={groupsWithLabels} tgGroups={tgGroups} />
}
